import TaskBackend from './task-backend.js'

/**
 * Todoist API client using the Sync endpoint for efficient data retrieval
 */
class TodoistBackend extends TaskBackend {
    constructor(config) {
        super(config)
        this.token = config.token
        this.baseUrl = 'https://api.todoist.com/api/v1'
        this.syncTokenKey = 'todoist_sync_token'
        this.dataKey = 'todoist_data'

        this.syncToken = localStorage.getItem(this.syncTokenKey) || '*'
        this.data = JSON.parse(localStorage.getItem(this.dataKey) || '{}')
    }

    /**
     * Perform a sync request to get tasks and related data
     */
    async sync(
        resourceTypes = ['items', 'labels', 'projects'],
        isRetry = false
    ) {
        const formData = new FormData()
        formData.append('sync_token', this.syncToken)
        formData.append('resource_types', JSON.stringify(resourceTypes))

        try {
            const response = await fetch(`${this.baseUrl}/sync`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`todoist fetch failed: ${response.status}`)
            }

            const data = await response.json()

            this.updateLocalData(data)

            this.syncToken = data.sync_token
            try {
                localStorage.setItem(this.syncTokenKey, this.syncToken)
            } catch (error) {
                console.error('failed to save sync token:', error)
            }

            return data
        } catch (error) {
            if (!isRetry && this.syncToken !== '*') {
                this.syncToken = '*'
                try {
                    localStorage.setItem(this.syncTokenKey, this.syncToken)
                } catch (storageError) {
                    console.error('failed to reset sync token:', storageError)
                }
                return this.sync(resourceTypes, true)
            }
            throw error
        }
    }

    /**
     * Update local data storage with sync response
     */
    updateLocalData(syncData) {
        if (syncData.full_sync) {
            this.data = {
                items: syncData.items || [],
                labels: syncData.labels || [],
                projects: syncData.projects || [],
            }
        } else {
            // Merge incremental updates
            this.mergeData('items', syncData.items)
            this.mergeData('labels', syncData.labels)
            this.mergeData('projects', syncData.projects)
        }

        try {
            localStorage.setItem(this.dataKey, JSON.stringify(this.data))
        } catch (error) {
            console.error('failed to save todoist data to localStorage:', error)
            if (error.name === 'QuotaExceededError') {
                throw new Error('localStorage quota exceeded - please clear some data')
            }
            throw error
        }
    }

    /**
     * Generic merge function for all data types
     */
    mergeData(type, newData) {
        if (!newData) return
        if (!this.data[type]) this.data[type] = []

        newData.forEach((newItem) => {
            if (newItem.is_deleted) {
                this.data[type] = this.data[type].filter(
                    (item) => item.id !== newItem.id
                )
            } else {
                const existingIndex = this.data[type].findIndex(
                    (item) => item.id === newItem.id
                )
                if (existingIndex >= 0) {
                    this.data[type][existingIndex] = newItem
                } else {
                    this.data[type].push(newItem)
                }
            }
        })
    }

    /**
     * Get upcoming tasks and recently completed tasks
     */
    getTasks() {
        if (!this.data.items) return []

        const recentThreshold = new Date(new Date().getTime() - 5 * 60 * 1000) // 5 minutes ago

        const mappedTasks = this.data.items
            .filter((item) => {
                if (item.is_deleted) return false

                // Include unchecked tasks
                if (!item.checked) return true

                // Include recently completed tasks (within last 5 minutes)
                if (item.checked && item.completed_at) {
                    const completedAt = new Date(item.completed_at)
                    return completedAt > recentThreshold
                }

                return false
            })
            .map((item) => {
                let dueDate = null
                let hasTime = false

                if (item.due) {
                    if (item.due.date.includes('T')) {
                        dueDate = new Date(item.due.date)
                        hasTime = true
                    } else {
                        // offset to 23:59:59 if no time is provided
                        dueDate = new Date(item.due.date + 'T23:59:59')
                    }
                }

                return {
                    ...item,
                    project_name: this.getProjectName(item.project_id),
                    label_names: this.getLabelNames(item.labels),
                    due_date: dueDate,
                    has_time: hasTime,
                }
            })

        return TodoistBackend.sortTasks(mappedTasks)
    }

    /**
     * Static method to sort tasks
     */
    static sortTasks(tasks) {
        return tasks.sort((a, b) => {
            // Unchecked tasks first
            if (a.checked !== b.checked) return a.checked ? 1 : -1

            // Checked tasks: sort by completed_at (recent first)
            if (a.checked) {
                if (a.completed_at && b.completed_at) {
                    const diff =
                        new Date(b.completed_at).getTime() -
                        new Date(a.completed_at).getTime()
                    if (diff !== 0) return diff
                }
            }

            // Tasks with due dates first
            if (!a.due_date && b.due_date) return 1
            if (a.due_date && !b.due_date) return -1

            // Sort by due date (earliest first)
            if (a.due_date && b.due_date) {
                const diff = a.due_date.getTime() - b.due_date.getTime()
                if (diff !== 0) return diff
            }

            // If both have no due dates, non-project tasks come first
            if (!a.due_date && !b.due_date) {
                const aHasProject = a.project_id && a.project_name && a.project_name !== 'Inbox'
                const bHasProject = b.project_id && b.project_name && b.project_name !== 'Inbox'

                if (aHasProject !== bHasProject) {
                    return aHasProject ? 1 : -1
                }
            }

            // Sort by child_order, defaulting to 0 if undefined
            const aOrder = a.child_order ?? 0
            const bOrder = b.child_order ?? 0
            return aOrder - bOrder
        })
    }

    /**
     * Get project name by ID
     */
    getProjectName(projectId) {
        return this.data.projects?.find((p) => p.id === projectId)?.name || ''
    }

    /**
     * Get label names by label IDs
     */
    getLabelNames(labelIds) {
        if (!labelIds || !this.data.labels) return []
        return labelIds
            .map((id) => this.data.labels.find((l) => l.id === id)?.name)
            .filter(Boolean)
    }

    /**
     * Complete a task
     */
    async completeTask(taskId) {
        const commands = [
            {
                type: 'item_close',
                uuid: crypto.randomUUID(),
                args: {
                    id: taskId,
                },
            },
        ]

        return this.executeCommands(commands)
    }

    /**
     * Uncomplete a task (undo completion)
     */
    async uncompleteTask(taskId) {
        const commands = [
            {
                type: 'item_uncomplete',
                uuid: crypto.randomUUID(),
                args: {
                    id: taskId,
                },
            },
        ]

        return this.executeCommands(commands)
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        const commands = [
            {
                type: 'item_delete',
                uuid: crypto.randomUUID(),
                args: {
                    id: taskId,
                },
            },
        ]

        return this.executeCommands(commands)
    }

    /**
     * Add a new task
     */
    async addTask(content, due, projectId) {
        const tempId = crypto.randomUUID()
        const commands = [
            {
                type: 'item_add',
                temp_id: tempId,
                uuid: crypto.randomUUID(),
                args: {
                    content: content,
                    ...(due
                        ? {
                              due: {
                                  date: due,
                              },
                          }
                        : {}),
                    ...(projectId ? { project_id: projectId } : {}),
                },
            },
        ]

        return this.executeCommands(commands)
    }

    /**
     * Edit a task's content/title in Todoist via sync commands
     */
    async editTaskName(taskId, newContent) {
        const commands = [
            {
                type: 'item_update',
                uuid: crypto.randomUUID(),
                args: {
                    id: taskId,
                    content: newContent,
                },
            },
        ]

        return this.executeCommands(commands)
    }

    /**
     * Execute sync commands
     */
    async executeCommands(commands) {
        const formData = new FormData()
        formData.append('commands', JSON.stringify(commands))

        const response = await fetch(`${this.baseUrl}/sync`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
            body: formData,
        })

        if (!response.ok) {
            throw new Error(`todoist command fetch failed: ${response.status}`)
        }

        const data = await response.json()

        return data
    }

    /**
     * Clear local storage when the API token changes
     */
    clearLocalData() {
        localStorage.removeItem(this.syncTokenKey)
        localStorage.removeItem(this.dataKey)
        this.syncToken = '*'
        this.data = {}
    }
}

export default TodoistBackend
