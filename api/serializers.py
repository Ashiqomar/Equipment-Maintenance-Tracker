from datetime import timedelta

from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import serializers

from .models import Equipment, MaintenanceLog, Notification, User


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs.get("username"),
            password=attrs.get("password"),
        )
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role"]


class TechnicianCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            role=User.TECHNICIAN,
        )


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = ["id", "name", "type", "last_service_date", "next_service_date"]


class NotificationSerializer(serializers.ModelSerializer):
    technician = UserSerializer(read_only=True)
    technician_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.TECHNICIAN),
        source="technician",
        write_only=True,
    )
    equipment = EquipmentSerializer(read_only=True)
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        source="equipment",
        write_only=True,
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "technician",
            "technician_id",
            "equipment",
            "equipment_id",
            "message",
            "is_completed",
            "created_at",
        ]
        read_only_fields = ["is_completed", "created_at"]


class MaintenanceLogSerializer(serializers.ModelSerializer):
    technician = UserSerializer(read_only=True)
    equipment = EquipmentSerializer(read_only=True)
    technician_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.TECHNICIAN),
        source="technician",
        write_only=True,
    )
    equipment_id = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.all(),
        source="equipment",
        write_only=True,
    )

    class Meta:
        model = MaintenanceLog
        fields = [
            "id",
            "equipment",
            "equipment_id",
            "technician",
            "technician_id",
            "service_date",
            "notes",
        ]


class NotificationCompleteSerializer(serializers.Serializer):
    service_date = serializers.DateField()
    notes = serializers.CharField(allow_blank=True, required=False)

    def validate(self, attrs):
        notification = self.context["notification"]
        if notification.is_completed:
            raise serializers.ValidationError("This notification is already completed.")
        return attrs

    @transaction.atomic
    def save(self, **kwargs):
        notification = self.context["notification"]
        service_date = self.validated_data["service_date"]
        notes = self.validated_data.get("notes", "")

        maintenance_log = MaintenanceLog.objects.create(
            equipment=notification.equipment,
            technician=notification.technician,
            service_date=service_date,
            notes=notes,
        )

        notification.equipment.last_service_date = service_date
        notification.equipment.next_service_date = service_date + timedelta(days=30)
        notification.equipment.save(update_fields=["last_service_date", "next_service_date"])

        notification.is_completed = True
        notification.save(update_fields=["is_completed"])

        return maintenance_log


# Beginner-friendly aliases used by the views below.
class SignInSerializer(LoginSerializer):
    pass


class TechnicianSerializer(TechnicianCreateSerializer):
    pass


class TaskSerializer(NotificationSerializer):
    pass


class CompleteTaskSerializer(NotificationCompleteSerializer):
    pass
