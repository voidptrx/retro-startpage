import TaskBackend from './task-backend.js'
import { isChrome } from '../utils/browser-detect.js'

/**
 * Google Tasks API client for Chrome Extensions
 * Uses chrome.identity.getAuthToken for OAuth (Chrome-only)
 */
class GoogleTasksBackendExtension extends TaskBackend {
    constructor(config = {}) {
        super(config)
        this.scopes = ['https://www.googleapis.com/auth/tasks']
        this.baseUrl = 'https://tasks.googleapis.com/tasks/v1'

        this.dataKey = 'google_tasks_data'
        this.tasklistIdKey = 'google_tasks_default_list'
        this.data = JSON.parse(localStorage.getItem(this.dataKey) ?? '{}')
        this.defaultTasklistId =
            localStorage.getItem(this.tasklistIdKey) ?? '@default'
        this.accessToken = null
        this.tokenPromise = null // Prevent multiple simultaneous token requests
    }

    /**
     * Get a valid access token using Chrome's identity API
     * This automatically handles token caching and refresh
     */
    async getAuthToken(interactive = false) {
        if (!isChrome()) {
            throw new Error(
                'Chrome identity API not available. Google Tasks only works in Chrome.'
            )
        }

        // If already getting a token, wait for that to complete
        if (this.tokenPromise) {
            return this.tokenPromise
        }

        this.tokenPromise = new Promise((resolve, reject) => {
            chrome.identity.getAuthToken(
                {
                    interactive: interactive,
                    scopes: this.scopes,
                },
                (token) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                        return
                    }

                    if (!token) {
                        reject(new Error('No token returned'))
                        return
                    }

                    this.accessToken = token
                    resolve(token)
                }
            )
        })

        try {
            return await this.tokenPromise
        } finally {
            this.tokenPromise = null
        }
    }

    /**
     * Sign in using Chrome's identity API
     * This handles OAuth flow automatically and keeps users signed in
     */
    async signIn() {
        if (!isChrome()) {
            throw new Error(
                'Chrome identity API not available. Google Tasks only works in Chrome.'
            )
        }

        await this.getAuthToken(true)
        return this.accessToken
    }

    /**
     * Sign out and clear cached tokens
     */
    async signOut() {
        if (!isChrome()) {
            throw new Error(
                'Chrome identity API not available. Google Tasks only works in Chrome.'
            )
        }

        // Remove cached token from Chrome
        if (this.accessToken) {
            await new Promise((resolve) => {
                chrome.identity.removeCachedAuthToken(
                    { token: this.accessToken },
                    () => {
                        resolve()
                    }
                )
            })
        }

        this.accessToken = null
        this.clearLocalData()
    }

    /**
     * Make an authenticated API request
     * Chrome identity API automatically handles token refresh
     */
    async apiRequest(endpoint, options = {}) {
        // Get a fresh token (Chrome caches it and auto-refreshes as needed)
        let token = await this.getAuthToken(false)

        const url = `${this.baseUrl}${endpoint}`
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        })

        if (!response.ok) {
            // If 401, invalidate cached token and try once more with interactive=false
            if (response.status === 401) {
                try {
                    // Remove the invalid token from cache
                    await new Promise((resolve) => {
                        chrome.identity.removeCachedAuthToken(
                            { token: token },
                            () => {
                                resolve()
                            }
                        )
                    })

                    // Get a new token
                    token = await this.getAuthToken(false)

                    // Retry the request with new token
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            ...options.headers,
                        },
                    })

                    if (!retryResponse.ok) {
                        throw new Error(
                            `API request failed: ${retryResponse.status} ${retryResponse.statusText}`
                        )
                    }

                    // Handle empty responses (e.g., DELETE requests)
                    if (
                        retryResponse.status === 204 ||
                        retryResponse.headers.get('content-length') === '0'
                    ) {
                        return null
                    }

                    return retryResponse.json()
                } catch (error) {
                    // Token refresh failed, user needs to sign in again
                    this.clearLocalData()
                    throw new Error(
                        'Authentication expired. Please sign in again.'
                    )
                }
            }

            throw new Error(
                `API request failed: ${response.status} ${response.statusText}`
            )
        }

        // Handle empty responses (e.g., DELETE requests)
        if (
            response.status === 204 ||
            response.headers.get('content-length') === '0'
        ) {
            return null
        }

        return response.json()
    }

    /**
     * Sync tasks from Google Tasks API
     */
    async sync(resourceTypes = ['tasklists', 'tasks']) {
        try {
            let newTasklists = this.data.tasklists
            let newTasks = this.data.tasks

            // Get task lists
            if (resourceTypes.includes('tasklists')) {
                const data = await this.apiRequest(
                    '/users/@me/lists?maxResults=20'
                )
                newTasklists = data.items || []

                const hasValidTasklist = newTasklists.some(
                    (tl) => tl.id === this.defaultTasklistId
                )
                if (!this.defaultTasklistId || !hasValidTasklist) {
                    this.defaultTasklistId =
                        newTasklists[0]?.id ?? '@default'
                    try {
                        localStorage.setItem(
                            this.tasklistIdKey,
                            this.defaultTasklistId
                        )
                    } catch (error) {
                        console.error('failed to save default tasklist ID:', error)
                    }
                }
            }

            // Get tasks from all lists in parallel
            if (resourceTypes.includes('tasks')) {
                // Only fetch completed tasks from the last 24 hours to avoid hitting the 100-task limit
                const completedMin = new Date(
                    Date.now() - 24 * 60 * 60 * 1000
                ).toISOString()

                const taskPromises = newTasklists.map(
                    async (tasklist) => {
                        const data = await this.apiRequest(
                            `/lists/${tasklist.id}/tasks?showCompleted=true&showHidden=true&showAssigned=true&maxResults=100`
                        )
                        // Add tasklist info to each task
                        return (data.items || []).map((task) => ({
                            ...task,
                            tasklistId: tasklist.id,
                            tasklistName: tasklist.title,
                        }))
                    }
                )

                const taskArrays = await Promise.all(taskPromises)
                newTasks = taskArrays.flat()

                // Filter out old completed tasks (keep last 24 hours)
                const completedThreshold = new Date(
                    Date.now() - 24 * 60 * 60 * 1000
                )
                newTasks = newTasks.filter((task) => {
                    // Keep all uncompleted tasks
                    if (task.status !== 'completed') return true
                    // Keep recently completed tasks
                    if (task.completed) {
                        const completedAt = new Date(task.completed)
                        return completedAt > completedThreshold
                    }
                    // Drop completed tasks without a completion date
                    return false
                })
            }

            // Only update this.data after all operations succeed
            this.data.tasklists = newTasklists
            this.data.tasks = newTasks

            try {
                localStorage.setItem(this.dataKey, JSON.stringify(this.data))
            } catch (error) {
                console.error('failed to save google tasks data to localStorage:', error)
                if (error.name === 'QuotaExceededError') {
                    throw new Error('localStorage quota exceeded - please clear some data')
                }
                throw error
            }

            return this.data
        } catch (error) {
            console.error('google tasks sync failed:', error)
            throw error
        }
    }

    /**
     * Get upcoming tasks and recently completed tasks
     */
    getTasks() {
        if (!this.data.tasks) return []

        const recentThreshold = new Date(new Date().getTime() - 5 * 60 * 1000)

        const mappedTasks = this.data.tasks
            .filter((task) => {
                if (task.status === 'needsAction') return true
                if (task.status === 'completed' && task.completed) {
                    const completedAt = new Date(task.completed)
                    return completedAt > recentThreshold
                }
                return false
            })
            .map((task) => {
                let dueDate = null

                if (task.due) {
                    // Google Tasks API only stores dates, not times
                    // Extract date portion to avoid timezone conversion issues
                    const dateOnly = task.due.split('T')[0]
                    dueDate = new Date(dateOnly + 'T23:59:59')
                }

                return {
                    id: task.id,
                    content: task.title,
                    notes: task.notes || '',
                    checked: task.status === 'completed',
                    completed_at: task.completed || null,
                    due: task.due ? { date: task.due } : null,
                    due_date: dueDate,
                    has_time: false,
                    project_id: task.tasklistId || null,
                    project_name: task.tasklistName || '',
                    labels: [],
                    label_names: [],
                    child_order: task.position ? parseInt(task.position) : 0,
                    parent_id: task.parent || null,
                    is_deleted: task.deleted || false,
                }
            })

        return GoogleTasksBackendExtension.sortTasks(mappedTasks)
    }

    /**
     * Sort tasks
     */
    static sortTasks(tasks) {
        return tasks.sort((a, b) => {
            // Sort by completion status first
            if (a.checked !== b.checked) return a.checked ? 1 : -1

            // Sort completed tasks by completion time (most recent first)
            if (a.checked && a.completed_at && b.completed_at) {
                const diff = new Date(b.completed_at) - new Date(a.completed_at)
                if (diff !== 0) return diff
            }

            // Sort by due date (tasks with no due date go last)
            if (a.due_date && b.due_date) {
                const diff = a.due_date - b.due_date
                if (diff !== 0) return diff
            }
            if (a.due_date !== b.due_date) return a.due_date ? -1 : 1

            // Finally sort by position
            return a.child_order - b.child_order
        })
    }

    /**
     * Get tasklist name by ID
     */
    getTasklistName(tasklistId) {
        return (
            this.data.tasklists?.find((tl) => tl.id === tasklistId)?.title ?? ''
        )
    }

    /**
     * Add a new task
     * Note: Google Tasks API only supports dates, not times
     */
    async addTask(content, due, tasklistId) {
        const taskData = { title: content }
        if (due) {
            // Google Tasks only supports date (YYYY-MM-DD), strip time if present
            const dateOnly = due.split('T')[0]
            taskData.due = dateOnly + 'T00:00:00.000Z'
        }

        const targetListId = tasklistId || this.defaultTasklistId

        const result = await this.apiRequest(`/lists/${targetListId}/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData),
        })

        return result
    }

    /**
     * Complete a task
     */
    async completeTask(taskId) {
        const task = this.data.tasks?.find((t) => t.id === taskId)
        const tasklistId = task?.tasklistId ?? this.defaultTasklistId

        const result = await this.apiRequest(
            `/lists/${tasklistId}/tasks/${taskId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'completed',
                    completed: new Date().toISOString(),
                }),
            }
        )

        return result
    }

    /**
     * Uncomplete a task
     */
    async uncompleteTask(taskId) {
        const task = this.data.tasks?.find((t) => t.id === taskId)
        const tasklistId = task?.tasklistId ?? this.defaultTasklistId

        const result = await this.apiRequest(
            `/lists/${tasklistId}/tasks/${taskId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'needsAction',
                    completed: null,
                }),
            }
        )

        return result
    }

    /**
     * Edit a task's title/content in Google Tasks
     */
    async editTaskName(taskId, newContent) {
        const task = this.data.tasks?.find((t) => t.id === taskId)
        const tasklistId = task?.tasklistId ?? this.defaultTasklistId

        const result = await this.apiRequest(
            `/lists/${tasklistId}/tasks/${taskId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ title: newContent }),
            }
        )

        return result
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        const task = this.data.tasks?.find((t) => t.id === taskId)
        const tasklistId = task?.tasklistId ?? this.defaultTasklistId

        await this.apiRequest(`/lists/${tasklistId}/tasks/${taskId}`, {
            method: 'DELETE',
        })
    }

    /**
     * Clear local storage
     */
    clearLocalData() {
        localStorage.removeItem(this.dataKey)
        localStorage.removeItem(this.tasklistIdKey)
        this.data = {}
        this.defaultTasklistId = '@default'
    }
}

export default GoogleTasksBackendExtension
