const state = {
    user: null,
    equipment: [],
    technicians: [],
    statuses: [],
};

function getCookie(name) {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i += 1) {
        const item = cookies[i].trim();

        if (item.startsWith(name + "=")) {
            return decodeURIComponent(item.substring(name.length + 1));
        }
    }

    return "";
}

async function sendRequest(url, method = "GET", body = null) {
    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
        },
        credentials: "same-origin",
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.detail || data.non_field_errors?.[0] || "Request failed");
    }

    return data;
}

function showMessage(text) {
    const box = document.getElementById("loginMessage");
    box.textContent = text;
}

function showSectionMessage(elementId, text) {
    const box = document.getElementById(elementId);

    if (box) {
        box.textContent = text;
    }
}

function showUser() {
    const userBox = document.getElementById("userBox");

    if (!state.user) {
        userBox.innerHTML = "<p>Not logged in</p>";
        return;
    }

    userBox.innerHTML = `
        <p><strong>ID:</strong> ${state.user.id}</p>
        <p><strong>Username:</strong> ${state.user.username}</p>
        <p><strong>Role:</strong> ${state.user.role}</p>
    `;
}

function showPanels() {
    const adminPanel = document.getElementById("adminPanel");
    const technicianPanel = document.getElementById("technicianPanel");
    const logoutButton = document.getElementById("logoutButton");

    adminPanel.classList.add("hidden");
    technicianPanel.classList.add("hidden");
    logoutButton.classList.add("hidden");

    if (!state.user) {
        return;
    }

    logoutButton.classList.remove("hidden");

    if (state.user.role === "admin") {
        adminPanel.classList.remove("hidden");
    }

    if (state.user.role === "technician") {
        technicianPanel.classList.remove("hidden");
    }
}

function clearSectionMessages() {
    const ids = [
        "equipmentMessage",
        "technicianMessage",
        "taskMessageBox",
        "completeTaskMessage",
    ];

    ids.forEach((id) => showSectionMessage(id, ""));
}

function renderEquipmentList(items) {
    const box = document.getElementById("equipmentList");

    if (!box) {
        return;
    }

    if (!items.length) {
        box.innerHTML = "<p>No equipment found.</p>";
        return;
    }

    box.innerHTML = items
        .map(
            (item) => `
            <div class="item">
                <p><strong>${item.name}</strong> (${item.type})</p>
                <p>Last Service: ${item.last_service_date}</p>
                <p>Next Service: ${item.next_service_date}</p>
                <p>Equipment ID: ${item.id}</p>
            </div>
        `
        )
        .join("");
}

function isDueSoon(dateValue, days = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(dateValue);
    dueDate.setHours(0, 0, 0, 0);

    const lastDate = new Date(today);
    lastDate.setDate(today.getDate() + days);

    return dueDate <= lastDate;
}

function fillHistoryDropdown(items) {
    const dropdown = document.getElementById("historyEquipmentId");

    if (!dropdown) {
        return;
    }

    setDropdownOptions(
        dropdown,
        items.length ? "Select Equipment" : "No equipment available",
        items,
        (item) => item.name
    );

    if (items.length > 0) {
        loadHistoryForEquipment(items[0].id);
    }
}

function setDropdownOptions(dropdown, placeholder, items, labelBuilder) {
    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = placeholder;
    dropdown.appendChild(defaultOption);

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = labelBuilder(item);
        dropdown.appendChild(option);
    });

    if (items.length > 0) {
        dropdown.selectedIndex = 1;
    }
}

function fillEquipmentDropdown(items) {
    const dropdown = document.getElementById("taskEquipmentId");

    if (!dropdown) {
        return;
    }

    if (!items.length) {
        setDropdownOptions(dropdown, "No equipment available", [], () => "");
        return;
    }

    setDropdownOptions(
        dropdown,
        "Select Equipment",
        items,
        (item) => item.name
    );
}

function renderTaskList(tasks) {
    const box = document.getElementById("taskList");

    if (!tasks.length) {
        box.innerHTML = "<p>No tasks assigned.</p>";
        return;
    }

    box.innerHTML = tasks
        .map(
            (task) => `
            <div class="item">
                <p><strong>Notification ID:</strong> ${task.id}</p>
                <p><strong>Equipment:</strong> ${task.equipment.name}</p>
                <p><strong>Message:</strong> ${task.message}</p>
                <p><strong>Status:</strong> ${task.is_completed ? "Completed" : "Pending"}</p>
            </div>
        `
        )
        .join("");
}

function renderAdminNotificationList(tasks) {
    const box = document.getElementById("adminNotificationList");

    if (!tasks.length) {
        box.innerHTML = "<p>No notifications found.</p>";
        return;
    }

    box.innerHTML = tasks
        .map(
            (task) => `
            <div class="item">
                <p><strong>Status ID:</strong> ${task.id}</p>
                <p><strong>Technician:</strong> ${task.technician.username}</p>
                <p><strong>Equipment:</strong> ${task.equipment.name}</p>
                <p><strong>Message:</strong> ${task.message}</p>
                <p><strong>Status:</strong> ${task.is_completed ? "Completed" : "Pending"}</p>
            </div>
        `
        )
        .join("");
}

function renderAlertsList(items) {
    const box = document.getElementById("alertsList");

    if (!box) {
        return;
    }

    if (!items.length) {
        box.innerHTML = "<p>No due-soon maintenance alerts.</p>";
        return;
    }

    box.innerHTML = items
        .map(
            (item) => `
            <div class="item">
                <p><strong>${item.name}</strong></p>
                <p><strong>Type:</strong> ${item.type}</p>
                <p><strong>Next Service:</strong> ${item.next_service_date}</p>
            </div>
        `
        )
        .join("");
}

function renderHistoryList(logs) {
    const box = document.getElementById("historyList");

    if (!box) {
        return;
    }

    if (!logs.length) {
        box.innerHTML = "<p>No maintenance history found.</p>";
        return;
    }

    box.innerHTML = logs
        .map(
            (log) => `
            <div class="item">
                <p><strong>Service Date:</strong> ${log.service_date}</p>
                <p><strong>Technician:</strong> ${log.technician.username}</p>
                <p><strong>Notes:</strong> ${log.notes || "No notes"}</p>
            </div>
        `
        )
        .join("");
}

function updateSummaryCards(summary) {
    document.getElementById("summaryEquipment").textContent = summary.total_equipment;
    document.getElementById("summaryTechnicians").textContent = summary.total_technicians;
    document.getElementById("summaryPending").textContent = summary.pending_tasks;
    document.getElementById("summaryCompleted").textContent = summary.completed_tasks;
}

function renderTechnicianList(technicians) {
    const box = document.getElementById("technicianList");

    if (!technicians.length) {
        box.innerHTML = "<p>No technicians found.</p>";
        return;
    }

    box.innerHTML = technicians
        .map(
            (technician) => `
            <div class="item">
                <p><strong>ID:</strong> ${technician.id}</p>
                <p><strong>Username:</strong> ${technician.username}</p>
                <p><strong>Email:</strong> ${technician.email || "No email"}</p>
                <p><strong>Role:</strong> ${technician.role}</p>
            </div>
        `
        )
        .join("");
}

function fillTechnicianDropdown(technicians) {
    const dropdown = document.getElementById("taskTechnicianId");

    if (!dropdown) {
        return;
    }

    if (!technicians.length) {
        setDropdownOptions(dropdown, "No technicians available", [], () => "");
        return;
    }

    setDropdownOptions(
        dropdown,
        "Select Technician",
        technicians,
        (technician) => `${technician.username} (${technician.email || "No email"})`
    );
}

async function loadAdminDropdowns() {
    try {
        const [technicians, equipment] = await Promise.all([
            sendRequest("/technicians"),
            sendRequest("/equipment"),
        ]);

        state.technicians = technicians;
        state.equipment = equipment;
        fillTechnicianDropdown(technicians);
        fillEquipmentDropdown(equipment);
        fillHistoryDropdown(equipment);
        updateSummaryCards({
            total_equipment: equipment.length,
            total_technicians: technicians.length,
            pending_tasks: state.statuses.filter((task) => !task.is_completed).length,
            completed_tasks: state.statuses.filter((task) => task.is_completed).length,
        });
        renderAlertsList(equipment.filter((item) => isDueSoon(item.next_service_date)));
    } catch (error) {
        showSectionMessage("taskMessageBox", "Could not load technician or equipment list.");
    }
}

async function loadAlerts() {
    try {
        const alerts = state.equipment.filter((item) => isDueSoon(item.next_service_date));
        renderAlertsList(alerts);
    } catch (error) {
        document.getElementById("alertsList").innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadHistoryForEquipment(equipmentId) {
    if (!equipmentId) {
        document.getElementById("historyList").innerHTML = "<p>Select equipment first.</p>";
        return;
    }

    try {
        const logs = await sendRequest(`/maintenance/${equipmentId}`);
        renderHistoryList(logs);
    } catch (error) {
        document.getElementById("historyList").innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadAdminStatus() {
    const search = document.getElementById("statusSearchInput").value.trim();
    const status = document.getElementById("statusFilterSelect").value;
    const params = new URLSearchParams();

    if (search) {
        params.set("search", search);
    }

    if (status) {
        params.set("status", status);
    }

    const query = params.toString() ? `?${params.toString()}` : "";

    try {
        const tasks = await sendRequest(`/notifications${query}`);
        state.statuses = tasks;
        renderAdminNotificationList(tasks);
        updateSummaryCards({
            total_equipment: state.equipment.length,
            total_technicians: state.technicians.length,
            pending_tasks: tasks.filter((task) => !task.is_completed).length,
            completed_tasks: tasks.filter((task) => task.is_completed).length,
        });
    } catch (error) {
        document.getElementById("adminNotificationList").innerHTML = `<p>${error.message}</p>`;
    }
}

function resetDashboard() {
    state.user = null;
    showUser();
    showPanels();
    showMessage("");
    clearSectionMessages();
    document.getElementById("loginForm").reset();
    document.getElementById("userBox").innerHTML = "<p>Not logged in</p>";

    const clearBoxes = [
        "technicianList",
        "adminNotificationList",
        "equipmentList",
        "alertsList",
        "historyList",
        "taskList",
    ];

    clearBoxes.forEach((id) => {
        const box = document.getElementById(id);

        if (box) {
            box.innerHTML = "";
        }
    });

    const summaryDefaults = {
        summaryEquipment: "0",
        summaryTechnicians: "0",
        summaryPending: "0",
        summaryCompleted: "0",
    };

    Object.entries(summaryDefaults).forEach(([id, value]) => {
        const item = document.getElementById(id);

        if (item) {
            item.textContent = value;
        }
    });

    state.equipment = [];
    state.technicians = [];
    state.statuses = [];
}

const loadEquipmentButton = document.getElementById("loadEquipmentButton");

if (loadEquipmentButton) {
    loadEquipmentButton.addEventListener("click", async () => {
        try {
            const items = await sendRequest("/equipment");
            renderEquipmentList(items);
        } catch (error) {
            const equipmentBox = document.getElementById("equipmentList");

            if (equipmentBox) {
                equipmentBox.innerHTML = `<p>${error.message}</p>`;
            }
        }
    });
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        const data = await sendRequest("/login", "POST", {
            username: document.getElementById("username").value,
            password: document.getElementById("password").value,
        });

        state.user = data.user;
        showUser();
        showPanels();
        clearSectionMessages();
        showMessage(data.message);

        if (state.user.role === "admin") {
            await loadAdminStatus();
            await loadAdminDropdowns();
            await loadAlerts();
        }
    } catch (error) {
        showMessage(error.message);
    }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
        await sendRequest("/logout", "POST");
        resetDashboard();
    } catch (error) {
        showMessage(error.message);
    }
});

document.getElementById("equipmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await sendRequest("/equipment", "POST", {
            name: document.getElementById("equipmentName").value,
            type: document.getElementById("equipmentType").value,
            last_service_date: document.getElementById("lastServiceDate").value,
            next_service_date: document.getElementById("nextServiceDate").value,
        });
        showSectionMessage("equipmentMessage", "Equipment created successfully.");
        await loadAdminDropdowns();
        await loadAlerts();
    } catch (error) {
        showSectionMessage("equipmentMessage", error.message);
    }
});

document.getElementById("technicianForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await sendRequest("/technicians", "POST", {
            username: document.getElementById("techUsername").value,
            email: document.getElementById("techEmail").value,
            password: document.getElementById("techPassword").value,
        });
        showSectionMessage("technicianMessage", "Technician created successfully.");
        await loadAdminDropdowns();
    } catch (error) {
        showSectionMessage("technicianMessage", error.message);
    }
});

document.getElementById("loadTechniciansButton").addEventListener("click", async () => {
    try {
        const technicians = await sendRequest("/technicians");
        renderTechnicianList(technicians);
    } catch (error) {
        document.getElementById("technicianList").innerHTML = `<p>${error.message}</p>`;
    }
});

document.getElementById("taskForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await sendRequest("/notifications", "POST", {
            technician_id: document.getElementById("taskTechnicianId").value,
            equipment_id: document.getElementById("taskEquipmentId").value,
            message: document.getElementById("taskMessage").value,
        });
        showSectionMessage("taskMessageBox", "Task assigned successfully.");
        await loadAdminStatus();
    } catch (error) {
        showSectionMessage("taskMessageBox", error.message);
    }
});

document
    .getElementById("loadAdminNotificationsButton")
    .addEventListener("click", async () => {
        await loadAdminStatus();
    });

document.getElementById("loadAlertsButton").addEventListener("click", async () => {
    await loadAlerts();
});

document.getElementById("loadHistoryButton").addEventListener("click", async () => {
    const equipmentId = document.getElementById("historyEquipmentId").value;
    await loadHistoryForEquipment(equipmentId);
});

document.getElementById("historyEquipmentId").addEventListener("change", async (event) => {
    await loadHistoryForEquipment(event.target.value);
});

document.getElementById("loadTasksButton").addEventListener("click", async () => {
    if (!state.user) {
        showMessage("Please login first.");
        return;
    }

    try {
        const tasks = await sendRequest(`/notifications/${state.user.id}`);
        renderTaskList(tasks);
    } catch (error) {
        document.getElementById("taskList").innerHTML = `<p>${error.message}</p>`;
    }
});

document.getElementById("completeTaskForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await sendRequest(
            `/notifications/${document.getElementById("completeTaskId").value}/complete`,
            "PATCH",
            {
                service_date: document.getElementById("completeServiceDate").value,
                notes: document.getElementById("completeNotes").value,
            }
        );
        showSectionMessage("completeTaskMessage", "Task completed successfully.");
    } catch (error) {
        showSectionMessage("completeTaskMessage", error.message);
    }
});

showUser();
