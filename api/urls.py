from django.urls import path
from .views import (
    CompleteTaskApi,
    DashboardSummaryApi,
    EquipmentApi,
    EquipmentMaintenanceApi,
    LogoutApi,
    MaintenanceApi,
    ServiceAlertsApi,
    SignInApi,
    TaskApi,
    TechnicianApi,
    TechnicianTaskListApi,
    home_page,
)

urlpatterns = [
    path("", home_page, name="home"),
    path("login", SignInApi.as_view(), name="login"),
    path("logout", LogoutApi.as_view(), name="logout"),
    path("dashboard-summary", DashboardSummaryApi.as_view(), name="dashboard-summary"),
    path("alerts", ServiceAlertsApi.as_view(), name="service-alerts"),
    path("equipment", EquipmentApi.as_view(), name="equipment-list-create"),
    path("technicians", TechnicianApi.as_view(), name="technician-create"),
    path("notifications", TaskApi.as_view(), name="notification-create"),
    path(
        "notifications/<int:technician_id>",
        TechnicianTaskListApi.as_view(),
        name="technician-notifications",
    ),
    path(
        "notifications/<int:pk>/complete",
        CompleteTaskApi.as_view(),
        name="notification-complete",
    ),
    path("maintenance", MaintenanceApi.as_view(), name="maintenance-create"),
    path(
        "maintenance/<int:equipment_id>",
        EquipmentMaintenanceApi.as_view(),
        name="maintenance-by-equipment",
    ),
]
