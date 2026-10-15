
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const message = document.querySelector('#message');

const validStatuses = ['Planned', 'In Progress', 'Completed'];

let projects = [];
let editingId = null;
let isBusy = false;
let hasLoadedProjects = false;

// Read an API response and preserve useful server error messages.
async function readResponse(response) {
    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        const error = new Error(
            data && typeof data.error === 'string'
                ? data.error
                : `Request failed with status ${response.status}.`
        );

        error.isApiError = true;
        throw error;
    }

    return data;
}

// Send a same-origin request and distinguish network failures.
async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch {
        const error = new Error(
            'Could not connect to the server. Check that it is running and try again.'
        );

        error.isNetworkError = true;
        throw error;
    }

    return readResponse(response);
}

// Read the collection from the API.
async function fetchProjects() {
    const data = await apiRequest('/api/projects');

    if (
        !Array.isArray(data) ||
        !data.every(project =>
            project &&
            typeof project === 'object' &&
            (typeof project.id === 'number' ||
                (typeof project.id === 'string' && project.id.trim() !== '')) &&
            typeof project.name === 'string' &&
            project.name.trim() !== '' &&
            validStatuses.includes(project.status)
        )
    ) {
        throw new Error('The server returned an invalid project list.');
    }

    return data;
}

// Update controls while loading or saving.
function setBusy(busy) {
    isBusy = busy;

    form.querySelectorAll('input, select, button').forEach(control => {
        control.disabled = busy;
    });

    projectList.querySelectorAll('button').forEach(button => {
        button.disabled = busy;
    });
}

// Reset the form to Add mode.
function resetForm() {
    form.reset();
    editingId = null;
    saveButton.textContent = 'Save Project';
    cancelButton.hidden = true;
}

// Render the most recently loaded API collection.
function renderProjects() {
    projectList.replaceChildren();

    // A failed initial load must not look like an empty collection.
    emptyState.hidden = !hasLoadedProjects || projects.length > 0;

    projects.forEach(project => {
        const listItem = document.createElement('li');

        const projectTitle = document.createElement('strong');
        projectTitle.textContent = project.name;

        const projectStatus = document.createElement('p');
        projectStatus.textContent = `Status: ${project.status}`;

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        editButton.disabled = isBusy;

        editButton.addEventListener('click', () => {
            if (isBusy) return;

            editingId = project.id;
            nameInput.value = project.name;
            statusInput.value = project.status;

            saveButton.textContent = 'Save changes';
            cancelButton.hidden = false;
            message.textContent = `Editing "${project.name}".`;

            nameInput.focus();
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.disabled = isBusy;

        deleteButton.addEventListener('click', async () => {
            if (isBusy) return;

            const confirmed = window.confirm(
                `Are you sure you want to delete "${project.name}"?`
            );

            // A cancelled deletion makes no API request.
            if (!confirmed) return;

            await deleteProject(project);
        });

        listItem.append(
            projectTitle,
            projectStatus,
            editButton,
            deleteButton
        );

        projectList.appendChild(listItem);
    });
}

// Load the latest collection after initial startup or a mutation.
async function refreshProjects(successMessage = '') {
    try {
        const latestProjects = await fetchProjects();

        projects = latestProjects;
        hasLoadedProjects = true;
        renderProjects();

        if (successMessage) {
            message.textContent = successMessage;
        }

        return true;
    } catch (error) {
        console.error('Could not load projects:', error);

        message.textContent = successMessage
            ? `${successMessage} However, the project list could not be refreshed. ${error.message}`
            : `Could not load projects. ${error.message}`;

        // Keep the last successfully loaded collection.
        // Do not show the empty state after a failed initial load.
        renderProjects();
        return false;
    }
}

// Add a project or save edits to an existing project.
form.addEventListener('submit', async event => {
    event.preventDefault();

    if (isBusy) return;

    const name = nameInput.value.trim();
    const status = statusInput.value;

    if (name.length < 1 || name.length > 80) {
        message.textContent = 'Project name must be between 1 and 80 characters.';
        nameInput.focus();
        return;
    }

    if (!validStatuses.includes(status)) {
        message.textContent = 'Please select a valid project status.';
        statusInput.focus();
        return;
    }

    const wasEditing = editingId !== null;
    const projectId = editingId;

    const url = wasEditing
        ? `/api/projects/${encodeURIComponent(projectId)}`
        : '/api/projects';

    const method = wasEditing ? 'PUT' : 'POST';

    setBusy(true);
    message.textContent = wasEditing
        ? 'Saving project changes...'
        : 'Saving project...';

    try {
        await apiRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, status })
        });

        // Reset only after the mutation succeeds.
        resetForm();

        const successMessage = wasEditing
            ? 'Project updated successfully.'
            : 'Project added successfully.';

        await refreshProjects(successMessage);
    } catch (error) {
        console.error('Could not save project:', error);

        // Keep the entered values and editing ID after failure.
        message.textContent = error.message ||
            'Could not save the project. Please try again.';
    } finally {
        setBusy(false);
        renderProjects();
    }
});

// Delete a project only after the user confirms.
async function deleteProject(project) {
    setBusy(true);
    message.textContent = 'Deleting project...';

    try {
        await apiRequest(
            `/api/projects/${encodeURIComponent(project.id)}`,
            { method: 'DELETE' }
        );

        // If the deleted project was being edited, return to Add mode.
        if (editingId === project.id) {
            resetForm();
        }

        await refreshProjects('Project deleted successfully.');
    } catch (error) {
        console.error('Could not delete project:', error);

        message.textContent = error.message ||
            'Could not delete the project. Please try again.';
    } finally {
        setBusy(false);
        renderProjects();
    }
}

// Cancel editing without sending a request or changing saved records.
cancelButton.addEventListener('click', () => {
    if (isBusy) return;

    resetForm();
    message.textContent = 'Editing cancelled.';
});

// Initial API load. A failure is an error, not an empty-list success.

async function initialize() {
    setBusy(true);
    message.textContent = 'Loading projects...';

    try {
        await refreshProjects();
    } finally {
        setBusy(false);
        renderProjects();
    }
}

initialize();
