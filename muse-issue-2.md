## 🎭 Muse — Website Suggestion
**Agent:** Muse | **Day:** Thursday | **Date:** 2024-05-23

---

### 👤 Visitor Story
As a potential user, I want to see a step-by-step visual guide of how the extension actually works inside Google Classroom, so that I can understand the workflow and trust that it will be easy to use before I decide to install it.

### 🔍 Current State
The home page (`website/src/routes/+page.svelte`) mentions features and benefits, but it lacks a clear, sequential visual breakdown of the actual user journey (e.g., Step 1: Open Classroom, Step 2: Click Extension, Step 3: Download Complete). Visitors have to infer how it works or install it to find out.

### 💡 Proposed Improvement
Add a dedicated "How It Works" page (or a prominent section on the home page) with annotated screenshots or a short GIF/video demonstrating the workflow.
- **Content:** A simple 3-4 step process (Install, Open Assignment, Click Download, Profit).
- **Visuals:** High-quality, annotated screenshots showing the extension UI overlaying a typical Google Classroom assignment page.
- **Location:** Either a new route `website/src/routes/how-it-works/+page.svelte` or a distinct, prominent section injected into the existing `website/src/routes/+page.svelte`.

### 🎯 Why This Matters
Seeing is believing. Many users are hesitant to install browser extensions due to security concerns or fear of complexity. Showing them exactly what the extension looks like and how simple it is to operate builds immediate trust and significantly reduces the friction to conversion.

### 📐 Acceptance Criteria
- [ ] A "How It Works" flow is created (either as a new page or a home page section).
- [ ] The flow includes 3-4 distinct steps with accompanying visuals (screenshots, GIFs, or video).
- [ ] Visuals accurately represent the current extension UI.
- [ ] Responsive design ensures visuals scale appropriately on mobile devices.
- [ ] Accessibility: all visuals have descriptive alt text explaining the action shown.

### 🔧 Technical Context
- **Affected Route:** `website/src/routes/+page.svelte` (if added as a section) or a new `website/src/routes/how-it-works/+page.svelte`.
- **Assets:** Requires new image/GIF assets to be added to `website/static/images/`.

### 📊 Estimated Complexity
Small to Medium (2-4 days). Primarily depends on the effort required to capture high-quality, annotated screenshots or screen recordings of the extension in action.

### 🔗 Related
- Home page: `website/src/routes/+page.svelte`