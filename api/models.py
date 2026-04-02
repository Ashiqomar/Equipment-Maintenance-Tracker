from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ADMIN = "admin"
    TECHNICIAN = "technician"
    ROLE_CHOICES = [
        (ADMIN, "Admin"),
        (TECHNICIAN, "Technician"),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=TECHNICIAN)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Equipment(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=255)
    last_service_date = models.DateField()
    next_service_date = models.DateField()

    def __str__(self):
        return self.name


class MaintenanceLog(models.Model):
    equipment = models.ForeignKey(
        Equipment, on_delete=models.CASCADE, related_name="maintenance_logs"
    )
    technician = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="maintenance_logs",
        limit_choices_to={"role": User.TECHNICIAN},
    )
    service_date = models.DateField()
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.equipment.name} serviced on {self.service_date}"


class Notification(models.Model):
    technician = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        limit_choices_to={"role": User.TECHNICIAN},
    )
    equipment = models.ForeignKey(
        Equipment, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.TextField()
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Task for {self.technician.username} - {self.equipment.name}"
