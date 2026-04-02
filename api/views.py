from datetime import timedelta
from django.contrib.auth import login, logout
from django.db.models import Q
from django.shortcuts import render
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Equipment, MaintenanceLog, Notification, User
from .serializers import (
    CompleteTaskSerializer,
    EquipmentSerializer,
    MaintenanceLogSerializer,
    SignInSerializer,
    TaskSerializer,
    TechnicianSerializer,
    UserSerializer,
)


def home_page(request):
    return render(request, "api/index.html")


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.ADMIN
        )


class IsLoggedInUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class SignInApi(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        login_data = SignInSerializer(data=request.data)
        login_data.is_valid(raise_exception=True)
        user = login_data.validated_data["user"]
        login(request, user)
        return Response(
            {
                "message": "Login successful",
                "user": UserSerializer(user).data,
            }
        )


class LogoutApi(APIView):
    permission_classes = [IsLoggedInUser]

    def post(self, request):
        logout(request)
        return Response({"message": "Logged out successfully."})


class DashboardSummaryApi(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(
            {
                "total_equipment": Equipment.objects.count(),
                "total_technicians": User.objects.filter(role=User.TECHNICIAN).count(),
                "pending_tasks": Notification.objects.filter(is_completed=False).count(),
                "completed_tasks": Notification.objects.filter(is_completed=True).count(),
            }
        )


class ServiceAlertsApi(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        today = timezone.localdate()
        due_date = today + timedelta(days=days)

        equipment = Equipment.objects.filter(
            next_service_date__lte=due_date,
        ).order_by("next_service_date")

        return Response(EquipmentSerializer(equipment, many=True).data)


class EquipmentApi(generics.ListCreateAPIView):
    serializer_class = EquipmentSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = Equipment.objects.all().order_by("id")
        search = self.request.query_params.get("search", "").strip()
        equipment_type = self.request.query_params.get("type", "").strip()

        if search:
            queryset = queryset.filter(name__icontains=search)

        if equipment_type:
            queryset = queryset.filter(type__icontains=equipment_type)

        return queryset


class TechnicianApi(generics.ListCreateAPIView):
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        return User.objects.filter(role=User.TECHNICIAN).order_by("id")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return UserSerializer
        return TechnicianSerializer


class TaskApi(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = Notification.objects.select_related("technician", "equipment").order_by(
            "-created_at"
        )
        status_filter = self.request.query_params.get("status", "").strip().lower()
        search = self.request.query_params.get("search", "").strip()

        if status_filter == "completed":
            queryset = queryset.filter(is_completed=True)
        elif status_filter == "pending":
            queryset = queryset.filter(is_completed=False)

        if search:
            queryset = queryset.filter(
                Q(technician__username__icontains=search)
                | Q(equipment__name__icontains=search)
                | Q(message__icontains=search)
            )

        return queryset


class TechnicianTaskListApi(generics.ListAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsLoggedInUser]

    def get_queryset(self):
        technician_id = self.kwargs["technician_id"]
        current_user = self.request.user

        if current_user.role == User.TECHNICIAN and current_user.id != technician_id:
            return Notification.objects.none()

        return Notification.objects.filter(technician_id=technician_id).order_by(
            "-created_at"
        )


class CompleteTaskApi(APIView):
    permission_classes = [IsLoggedInUser]

    def patch(self, request, pk):
        try:
            task = Notification.objects.select_related(
                "technician", "equipment"
            ).get(pk=pk)
        except Notification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.role == User.TECHNICIAN and request.user != task.technician:
            return Response(
                {"detail": "You can only complete your own tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        complete_data = CompleteTaskSerializer(
            data=request.data,
            context={"notification": task},
        )
        complete_data.is_valid(raise_exception=True)
        maintenance_log = complete_data.save()

        return Response(
            {
                "message": "Task completed successfully.",
                "maintenance_log": MaintenanceLogSerializer(maintenance_log).data,
            }
        )


class MaintenanceApi(generics.CreateAPIView):
    serializer_class = MaintenanceLogSerializer
    permission_classes = [IsLoggedInUser]

    @transaction.atomic
    def perform_create(self, serializer):
        current_user = self.request.user
        technician = serializer.validated_data["technician"]

        if current_user.role == User.TECHNICIAN and current_user != technician:
            raise permissions.PermissionDenied("You can only create your own logs.")

        equipment = serializer.validated_data["equipment"]
        service_date = serializer.validated_data["service_date"]

        equipment.last_service_date = service_date
        equipment.next_service_date = service_date + timedelta(days=30)
        equipment.save(update_fields=["last_service_date", "next_service_date"])
        serializer.save()


class EquipmentMaintenanceApi(generics.ListAPIView):
    serializer_class = MaintenanceLogSerializer
    permission_classes = [IsLoggedInUser]

    def get_queryset(self):
        return MaintenanceLog.objects.filter(
            equipment_id=self.kwargs["equipment_id"]
        ).order_by("-service_date", "-id")
