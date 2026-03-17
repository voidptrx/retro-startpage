# 🖥️ minimal-startpage 

A minimal, terminal-inspired browser startpage with a "geek-centric" aesthetic. This project is designed to be a functional and distraction-free dashboard for developers and power users.
<img width="1800" height="900" alt="Screenshot 2026-03-17 at 17-14-22 ~_startpage" src="https://github.com/user-attachments/assets/88c5080d-15ff-4dc9-8139-3b331f5ba931" />


## 🛠️ Features

* **Real-time Clock & Date**: Displays a 24-hour clock and the current date in a clean, lowercase monospace format.
* **Dynamic Calendar**: A minimalist monthly grid that automatically highlights the current day.
* **Weather Widget**: Fetches real-time data (temperature, humidity, wind speed, and precipitation) using the Open-Meteo API. Includes a 5-hour forecast.
* **Pomodoro Timer**:
    * **Modes**: Automatic switching between Focus (25m), Short Break (5m), and Long Break (15m).
    * **Visual Feedback**: Progress bar and percentage indicator.
    * **Hotkeys**: Fully controllable via keyboard (Space, S, R).
* **Quick Links**: A curated 4x5 grid of links covering Linux, development, and language learning tools.

## 🎨 Aesthetic & Design

The UI is built with a focus on scannability and "terminal" vibes:
- **Font**: Uses `JetBrainsMono NFM` for a consistent coding environment feel.
- **Colors**: A dark, custom palette (Gruvbox/Kanagawa inspired) defined via CSS variables.
- **Layout**: CSS Grid-based responsive design with a fixed-width `700px` container for a centered dashboard look.

## 🚀 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/lvntcnylmz/restartpage.git
    ```
2.  **Configure Weather**:
    Open `script.js` and update the `lat` and `lon` variables to your local coordinates:
    ```javascript
    const lat = 41.4, lon = 27.35; // Example: Lüleburgaz
    ```
3.  **Set as Startpage**:
    Open `index.html` in your browser and set it as your home page or use a custom new tab extension.

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Start / Pause Pomodoro |
| `S` | Skip Current Session |
| `R` | Reset Pomodoro |

## 📦 Tech Stack

- **HTML5 / CSS3** (Grid & Flexbox)
- **Vanilla JavaScript** (ES6+)
- **Open-Meteo API** (No API key required)
