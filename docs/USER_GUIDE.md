# CourseVideo Studio - User Guide

Welcome to CourseVideo Studio, an AI-powered presentation and video generator for course creators. This guide will walk you through all the features and help you create professional course videos.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Courses and Lessons](#creating-courses-and-lessons)
3. [The Slide Editor](#the-slide-editor)
4. [AI-Powered Slide Generation](#ai-powered-slide-generation)
5. [Writing and Generating Scripts](#writing-and-generating-scripts)
6. [Generating Voiceovers](#generating-voiceovers)
7. [Presentation Mode](#presentation-mode)
8. [Exporting Your Presentation](#exporting-your-presentation)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Logging In

1. Navigate to the application at `http://localhost:5173`
2. Enter your credentials:
   - **Email:** demo@example.com
   - **Password:** demo123
3. Click "Sign in" to access your dashboard

### Dashboard Overview

The dashboard displays all your courses. From here you can:
- View pinned courses at the top
- Search for courses by name
- Create new courses
- Access archived courses

---

## Creating Courses and Lessons

### Creating a Course

1. Click the **"+ New Course"** button in the dashboard header
2. Enter a course name (required) and optional description
3. Click **"Create"** to create the course

### Managing Courses

Each course card has a dropdown menu (⋮) with options to:
- **Edit** - Change course name and description
- **Pin/Unpin** - Pin important courses to the top
- **Archive** - Move to archived section
- **Delete** - Permanently remove the course

### Creating Lessons

1. Click on a course to open its detail page
2. Click **"+ New Lesson"** to add a lesson
3. Enter a lesson title and optional description
4. Click **"Create"** to add the lesson

### Organizing Lessons

- **Drag and drop** lessons to reorder them
- Use the dropdown menu to **Edit**, **Duplicate**, or **Delete** lessons
- Click **"Open Editor"** to start editing a lesson's slides

---

## The Slide Editor

The editor is organized into four main areas:

### Left Sidebar
- **Navigation tree** - Browse all courses and lessons
- **Slide thumbnails** - View and select slides in your deck

### Center Canvas
- **Slides tab** - View and edit slide content
- **Script tab** - Write speaker notes/narration scripts
- **Audio tab** - Generate voiceovers
- **Captions tab** - Manage subtitles

### Right Inspector
- Edit slide properties:
  - Title
  - Layout template
  - Body text or bullet points
  - Background color
  - Transition effect
  - Duration

### Bottom Timeline
- View all slides as scene blocks
- See total deck duration
- Play/pause preview
- Click slides to navigate

### Adding Slides

There are two ways to add slides:

1. **Manual** - Click the **+** button in the Slides section
2. **AI Generation** - Click the **✨** (wand) button to open the AI wizard

### Editing Slides

1. Click a slide thumbnail to select it
2. Use the Properties panel on the right to edit:
   - **Title** - The main heading
   - **Layout** - Choose from Title Only, Title+Body, Title+Bullets, Two Column, or Centered
   - **Background Color** - Pick a color using the color picker
   - **Transition** - Select None, Fade, Push, Dissolve, or Wipe
   - **Duration** - Set how long the slide appears (in seconds)

### Reordering Slides

Drag slides by the grip handle (⋮⋮) to reorder them.

---

## AI-Powered Slide Generation

### Opening the AI Wizard

1. In the editor, click the **✨** (wand) button in the Slides section
2. The AI Generation Wizard will open

### Generating from a Topic

1. Select **"Topic Prompt"** tab
2. Enter your presentation topic (e.g., "Introduction to Machine Learning")
3. Choose the number of slides (3, 5, 7, 10, or 15)
4. Click **"Generate Outline"**

### Generating from Notes

1. Select **"Paste Notes"** tab
2. Paste your lecture notes, bullet points, or content
3. Choose the number of slides
4. Click **"Generate Outline"**

### Reviewing the Outline

After generating, you'll see an editable outline:
- Edit slide titles by clicking on them
- Add, edit, or remove key points
- Click **"+ Add Slide"** to add more slides
- Remove slides by clicking the × button

### Creating Slides

1. Review and edit the outline
2. Click **"Generate X Slides"**
3. Wait for the AI to create slide content
4. Click **"View Slides"** when complete

---

## Writing and Generating Scripts

### The Script Tab

1. Select a slide
2. Click the **"Script"** tab in the center panel
3. You'll see a text editor for speaker notes

### Writing Manually

Simply type your narration script in the text editor. The script will be used to:
- Guide your presentation
- Generate voiceover audio
- Create captions

### AI Script Generation

1. Select the target duration (15s, 30s, or 60s)
2. Click **"Generate Script"** for the current slide
3. Or click **"Generate All"** to create scripts for all slides

The AI will create a natural-sounding narration script based on your slide content.

---

## Generating Voiceovers

### Prerequisites

Before generating voiceovers:
1. Ensure your slides have speaker notes (scripts)
2. Configure your ElevenLabs API key in `server/.env`

### Selecting a Voice

1. Click the **"Audio"** tab
2. Choose a voice from the dropdown menu
3. Available voices include Rachel, Domi, Bella, Antoni, and more

### Generating Audio

1. Select a slide with speaker notes
2. Click **"Generate Audio"** for a single slide
3. Or click **"Generate All"** for all slides with scripts

### Playing Audio

Once generated:
- Click the **Play** button to preview
- The duration is shown below the player
- Slide duration automatically updates to match

---

## Presentation Mode

### Starting a Presentation

1. Click the **"Present"** button in the top bar
2. The presentation opens in fullscreen

### Navigating

- **Arrow keys** or **Space** to advance
- **Escape** to exit presentation mode
- Use the on-screen controls for navigation

### Presenter Notes

Your speaker notes are available in the presenter view (press **S** during presentation).

---

## Exporting Your Presentation

### Export Options

Click the **"Export"** dropdown in the top bar to see options:

### RevealJS HTML

1. Select **"Export as RevealJS HTML"**
2. A self-contained HTML file downloads
3. Open in any browser for a standalone presentation
4. Share the file - no server required!

### Video (Coming Soon)

- **Render Video (MP4)** - Combine slides, audio, and captions into a video

### Other Formats (Coming Soon)

- **Export as PDF** - Print-ready slide deck
- **Export Captions** - SRT/VTT subtitle files

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **← / ↑** | Previous slide |
| **→ / ↓** | Next slide |
| **Delete / Backspace** | Delete selected slide |
| **Play button** | Start/stop preview playback |

### In Presentation Mode

| Shortcut | Action |
|----------|--------|
| **Space / → / ↓** | Next slide |
| **← / ↑** | Previous slide |
| **Escape** | Exit presentation |
| **O** | Overview mode |
| **S** | Speaker notes view |

---

## Troubleshooting

### AI Features Not Working

**Problem:** "OpenAI API key not configured" error

**Solution:**
1. Copy `server/env.template` to `server/.env`
2. Add your OpenAI API key
3. Restart the server

### Voiceover Generation Fails

**Problem:** "ElevenLabs API key not configured" error

**Solution:**
1. Get an API key from [elevenlabs.io](https://elevenlabs.io)
2. Add `ELEVENLABS_API_KEY=your-key` to `server/.env`
3. Restart the server

### Presentation Mode Not Loading

**Problem:** RevealJS presentation is blank

**Solution:**
1. Ensure you have at least one slide
2. Refresh the page
3. Try exporting as HTML instead

### Audio Not Playing

**Problem:** Generated audio won't play

**Solution:**
1. Check that the audio file exists in `data/assets/audio/`
2. Ensure your browser allows audio playback
3. Try regenerating the audio

---

## Getting Help

If you encounter issues:
1. Check the browser console for errors (F12)
2. Review the server logs in the terminal
3. Ensure all environment variables are configured

Happy creating! 🎬

