/// <reference types="svelte" />
/// <reference types="vite/client" />

// Chrome extension API types
declare namespace chrome {
    namespace identity {
        function getAuthToken(
            details: { interactive: boolean; scopes?: string[] },
            callback: (token?: string) => void
        ): void
        function removeCachedAuthToken(
            details: { token: string },
            callback: () => void
        ): void
    }
    namespace runtime {
        const lastError: { message: string } | undefined
        const id: string | undefined
    }
}
