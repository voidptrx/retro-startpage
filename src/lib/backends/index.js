import TodoistBackend from './todoist-backend.js'
import LocalStorageBackend from './localstorage-backend.js'
import GoogleTasksBackendExtension from './google-tasks-backend.js'

export function createTaskBackend(type, config) {
    switch (type) {
        case 'todoist':
            return new TodoistBackend(config)
        case 'local':
            return new LocalStorageBackend(config)
        case 'google-tasks':
            return new GoogleTasksBackendExtension(config)
        default:
            throw new Error(`Unknown backend type: ${type}`)
    }
}

export { TodoistBackend, LocalStorageBackend, GoogleTasksBackendExtension }
