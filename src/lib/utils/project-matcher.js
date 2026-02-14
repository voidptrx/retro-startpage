// Project/List matcher for task input
// Returns matched span + project info for highlighting and assignment.

import { stripMatch } from './date-matcher.js'

/**
 * Parse project match from input text
 * Supports #project name and #"project name" syntax
 *
 * @param {string} input - The task input text
 * @param {Array<{id: string, name: string}>} projects - Available projects/lists
 * @returns {Object|null} Match info with {match: {start, end}, projectId, projectName}
 */
export function parseProjectMatch(input, projects) {
    if (!input || !projects || projects.length === 0) return null

    // Find all # symbols
    let index = 0
    while (index < input.length) {
        index = input.indexOf('#', index)
        if (index === -1) break

        // Check if this is the start of a project reference
        // Must be at start or preceded by whitespace
        if (index > 0 && !/\s/.test(input[index - 1])) {
            index++
            continue
        }

        // Check for quoted syntax: #"project name"
        if (input[index + 1] === '"') {
            const quoteStart = index + 2
            const quoteEnd = input.indexOf('"', quoteStart)
            if (quoteEnd !== -1) {
                const matchText = input.slice(quoteStart, quoteEnd)
                const matchLower = matchText.toLowerCase()
                const project = projects.find(
                    (p) => p.name.toLowerCase() === matchLower
                )

                if (project) {
                    return {
                        match: {
                            start: index,
                            end: quoteEnd + 1,
                        },
                        projectId: project.id,
                        projectName: project.name,
                    }
                }
            }
        } else {
            // Unquoted syntax with greedy matching: #project or #project name
            // Try progressively longer strings and use the longest match
            let longestMatch = null
            let words = []
            let pos = index + 1

            // Extract words and try matching after each word
            while (pos < input.length && input[pos] !== '#') {
                // Skip whitespace
                while (pos < input.length && /\s/.test(input[pos])) {
                    pos++
                }

                if (pos >= input.length || input[pos] === '#') break

                // Get next word
                let wordEnd = pos
                while (wordEnd < input.length && !/[\s#]/.test(input[wordEnd])) {
                    wordEnd++
                }

                if (wordEnd > pos) {
                    words.push(input.slice(pos, wordEnd))

                    // Try matching accumulated words
                    const candidate = words.join(' ')
                    const candidateLower = candidate.toLowerCase()
                    const match = projects.find(
                        (p) => p.name.toLowerCase() === candidateLower
                    )

                    if (match) {
                        longestMatch = {
                            text: candidate,
                            end: wordEnd,
                            project: match,
                        }
                    }
                }

                pos = wordEnd
            }

            if (longestMatch) {
                return {
                    match: {
                        start: index,
                        end: longestMatch.end,
                    },
                    projectId: longestMatch.project.id,
                    projectName: longestMatch.project.name,
                }
            }
        }

        index++
    }

    return null
}

/**
 * Strip project match from text (uses shared stripMatch utility)
 * @param {string} text - The original text
 * @param {Object} match - Match object with {start, end}
 * @returns {string} Text with project match removed
 */
export function stripProjectMatch(text, match) {
    return stripMatch(text, match)
}
