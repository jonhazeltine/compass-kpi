# KPI APP \- Final Draft Scope

# 

# KPI Tracker App Project Plan (Updated with PC System Details)

## 1\. Project Overview: Gamified KPI Tracker App

This document outlines the requirements for a gamified KPI tracker app designed for real estate agents and team leaders. The application aims to provide a dynamic platform for tracking performance across various metrics, including three custom currencies: Projected Commissions (PC), Growth Points (GP), and Vitality Points (VP), alongside Actual GCI (Gross Commission Income) and Deals Closed.

The app will feature personalized dashboards, team collaboration tools, a dynamic challenge system, and engaging visual feedback mechanisms. It will be developed as a cross-platform mobile and web application, supported by a robust backend and an administrative dashboard for managing content and users.

This project involves hiring for three core roles:

* UI/UX \+ Marketing Website Designer  
* Flutter App \+ Admin Developer  
* Backend Developer (Firebase or Supabase)

## 2\. Designer Brief and Scope: UI/UX \+ Marketing Website

### 2.1. Purpose

The primary purpose of the UI/UX \+ Marketing Website Designer is to design the complete user interface and user experience (UI/UX) for the mobile and web KPI tracker app, to develop the core visual branding if not already provided, and to create a branded marketing website.

### 2.2. Key Responsibilities

* Design 12+ mobile and responsive web app screens.  
* Develop core branding elements (logo, color palette, typography) that embody a clean, sleek, simple, and unbusy aesthetic, ensuring consistency across all platforms. (Assuming no pre-existing brand assets).  
* Design and build a marketing website (via Webflow, Framer, or provide dev-ready handoff, which includes static HTML/CSS/JS files or design assets for a separate web developer to implement). Pages will include Home, Features, Pricing, FAQ, Contact, and Waitlist/signup. The Project Owner will lead on providing the primary copy for these pages, with the Designer responsible for integrating this copy into the design and providing feedback on its suitability and flow within the UI/UX.  
* Ensure branding consistency (either newly developed or provided) across the app and marketing website.  
* Deliver fully organized Figma files and Lottie-compatible animation references (or Lottie JSON files).  
* It is highly recommended that a wireframing phase be undertaken to define screen layouts, information architecture, and user flows before proceeding to high-fidelity visual design. This will facilitate early feedback and iteration.

### 2.3. Screen Requirements

The app requires the design of the following screens:

* Onboarding Flow: Collects name, email, average price point, commission rate; inputs goals (GCI Goal (next 365 days), Deals Closed Goal (next 365 days)); team assignment (optional); KPI selection for logging.  
* Individual Dashboard: Features Projected Commissions (PC \- focused on next 90 days), Growth Points (GP), and Vitality Points (VP) meters with animations; Actual GCI and Deals Closed display; Forecast Confidence Meter/Overlay on PC meter (displaying Green/Yellow/Red based on backend score). Design needs to accommodate a PC projection line graph showing future PC and changing confidence levels over time.  
* Tap-to-Log Screen: Swipeable by currency (PC, GP, VP, Custom); aims to display up to 6-8 KPIs per initial currency view (content within a currency tab becomes vertically scrollable if more KPIs are active); provides visual feedback (point float-up, meter animation, sound). For certain KPIs requiring direct value input (e.g., Actual GCI when logging a "Deal Closed"), the design must accommodate this input, typically via a modal after the primary KPI log. KPIs part of active challenges display visual labels.  
* Challenge View (Active Challenge): Displays challenge-specific KPIs, real-time progress tracker, currency-specific animations for each logged KPI, % complete, time remaining, team leaderboard snippet, and an option to invite teammates.  
* **Sponsored Challenge Detail View**:  
  * Displays sponsor branding (logo, color highlights, optional header banner).  
  * Includes full challenge description, associated KPIs, reward/prize details, CTA button (e.g., “Book a Call,” “Claim Reward,” or “Learn More”).  
  * Must include sponsor disclaimer text.  
  * Join Challenge button behaves like any normal challenge (saves participation, shows % complete).  
  * CTA must be distinguishable from in-app navigation, and open either an external browser or in-app browser with tracking URL support.  
* Challenge Selection Screen: Allows choosing from preset templates (based on user plan), toggling solo vs. team mode, and previewing description, goal, and duration.  
* Challenge Creation Screen (Teams Package): Enables choosing 3–6 KPIs across currencies, naming the challenge, selecting a label/icon, setting duration (and optional future start date), adding participants from the team, and launching the challenge.  
* **Sponsored Challenge Showcase**: A scrollable carousel or list of active branded challenges available to the user. Each card includes sponsor branding, reward highlights, a brief description, and a “Join” button. Sponsors may include external links or CTAs. Design should visually differentiate these from standard challenges (e.g., with a “Sponsored” badge and branded frame), while retaining all normal challenge mechanics. Users should be able to tap into a full Sponsored Challenge Detail screen.  
* KPI Selection Screen: Displays a master KPI list by category (sorted by currency, color-coded/styled by currency) with preview icon, animation type, and read-only value metadata; allows adding/removing KPIs to the tap-to-log screen (changes save automatically). KPI value metadata shown to users is admin-defined and non-editable in member-facing flows. KPIs part of active challenges display visual labels.  
* Team Dashboard:  
  * Primary Display (Center Stage):  
    * Aggregated Team Actual GCI.  
    * Aggregated Team 90-day Projected GCI.  
  * Team Member List:  
    * Each team member listed.  
    * Next to each member's name: their individual Actual GCI and individual 90-day Projected GCI.  
    * (Original requirements: aggregated team meters for PC, GP, VP, Deals Closed; individual member rows with progress bars; rank change animations, especially for 1st place; and team invite management \- these should be integrated around the primary display).  
  * Drill-Down Functionality: Tapping on a team member's name/row expands or navigates to show their more detailed individual KPIs/dashboard view.  
  * Access to Team Management: For Team Leaders, this screen provides access to "Manage Team" functionalities (Flow 8).  
* Settings/Profile: Manages account (including "Deactivate Account" option \- Flow 13), preferences, notifications; adjusts goal inputs (average price point, commission rate, GCI Goal (next 365 days), Deals Closed Goal (next 365 days)); and handles team invite management. Access to "Manage My KPIs" (Flow 4\) and "My Plan" (Flow 11). Includes "My Coaching" access point.  
* Subscription & Tiers Screen ("My Plan"): Displays feature breakdown by Free, Basic, Teams, Enterprise tiers, with an upgrade call-to-action (CTA). User's current plan is highlighted.  
* Coaching Promotion Screen: A visual CTA "Need help with your KPIs?" linking to a booking page; enterprise version features a dynamic CTA based on organizational preferences. Coaching messages related to forecast confidence should also be displayed contextually.

#### 2.3.1. Design for Loading, Empty, and Error States

A robust and user-friendly application requires thoughtful design for various states beyond the "ideal" path. The designer should provide mockups or guidelines for the following:

* Loading States:  
  * General Screen/Data Loading: When fetching data for dashboards, lists (e.g., challenges, team members), or user profiles.  
    * *Suggestion:* Use subtle loading indicators like spinners, shimmer effects (placeholder UI that mimics the layout with animated gradients), or progress bars integrated into the content area rather than full-screen blocking loaders where possible.  
  * Action Processing: When a user performs an action that requires backend processing (e.g., saving settings, joining a challenge, logging a complex KPI).  
    * *Suggestion:* Disable the interactive element (e.g., button shows a spinner) to prevent multiple submissions and provide immediate feedback.  
* Empty States:  
  * No KPIs Logged Yet (Dashboard): For new users or users who haven't logged activity.  
    * *Suggestion:* Friendly message, an illustration, and a clear Call to Action (CTA) to "Log Your First KPI" or "Explore KPIs."  
  * No Active Challenges: When the user views the challenges section but has no active challenges.  
    * *Suggestion:* Encouraging message, an illustration, and a CTA to "Discover Challenges" or "Start a New Challenge."  
  * No Challenges Available (Challenge List): If no preset, team, or sponsored challenges are available for the user's tier.  
    * *Suggestion:* Message explaining why (e.g., "Upgrade to access more challenges") or simply "No challenges available right now. Check back soon\!" with an appropriate visual.  
  * No Team Members Yet (Team Dashboard/Management for new Team Leader):  
    * *Suggestion:* Message guiding the leader to "Invite Your First Team Member."  
  * Search Results Not Found: When a user search yields no results (e.g., in KPI selection, challenge list, user search for admins).  
    * *Suggestion:* "No results found for '\[search term\]'. Try different keywords or check your spelling."  
  * Empty Lists: For any list view that might be empty (e.g., no custom KPIs created, no past coaching messages).  
    * *Suggestion:* Contextual message and a CTA to create the first item if applicable.  
* Error States:  
  * No Internet Connection: When the app cannot reach the backend.  
    * *Suggestion:* Clear, non-alarming message (e.g., "No Internet Connection. Please check your connection and try again.") with a "Retry" button. Consider an offline mode banner if some offline functionality exists.  
  * Server Error / API Error (Generic): When an unexpected backend error occurs.  
    * *Suggestion:* Friendly message (e.g., "Oops\! Something went wrong on our end. Please try again in a moment.") with a "Retry" button. Avoid showing technical error codes to the user.  
  * Form Validation Errors: For input fields during onboarding, settings, challenge creation, etc.  
    * *Suggestion:* Inline error messages below the respective fields (e.g., "Email is invalid," "Password must be at least 8 characters"). Highlight the problematic field.  
  * Action Failed (e.g., Failed to Join Challenge, Failed to Save Settings):  
    * *Suggestion:* Specific error message explaining what failed (if possible, without being too technical) and a "Try Again" or "OK" button.  
  * Authentication Errors (e.g., Session Expired, Invalid Credentials on Login):  
    * *Suggestion:* Clear message (e.g., "Your session has expired. Please log in again." or "Invalid email or password.").  
  * Permission Denied / Tier Restriction: (Already covered by "General Design Guideline for Tier-Restricted Features" \- greyed out \+ link to upgrade). This is a specific type of "error" or "blockage."  
* General Guidelines for these States:  
  * Clarity: Messages should be easy to understand, avoiding jargon.  
  * Conciseness: Keep messages brief and to the point.  
  * Guidance: Where possible, tell the user what they can do next (e.g., "Retry," "Go to Settings," "Create New").  
  * Visual Consistency: Use consistent styling (colors, typography, icons) that aligns with the app's overall brand.  
  * Empathy: Use a friendly and reassuring tone, especially for errors.

General Design Guideline for Tier-Restricted Features:

* Features or options unavailable to a user based on their current subscription tier (e.g., Free, Basic Solo) but available in higher tiers should still be visible in the UI where contextually appropriate.  
* These restricted features should be clearly indicated as unavailable (e.g., greyed out, locked icon).  
* Tapping on such a restricted feature should navigate the user directly to the "Subscription & Tiers Screen" (Flow 11\) to encourage an upgrade, displaying the benefits of the required tier.

### 2.4. Custom KPI Notes (Design)

Custom KPIs do not contribute to currencies (PC, GP, or VP). They must have a distinct, generic animation, can appear in challenge interfaces, and must appear in activity logs and visual performance tracking.

**Sponsored Challenge Note**:

* Only KPIs from the Master KPI Catalog may be used in Sponsored Challenges.  
* Custom KPIs are not eligible unless explicitly approved by an Admin and manually assigned to a Sponsored Challenge. (which should be possible)  
* The UI must prevent sponsors (or users) from selecting or creating Custom KPIs for sponsored challenges by default.

### 2.5. Team Leader Permissions (UI/UX)

Team Leaders have elevated controls in the Team Dashboard (access to team management) and Challenge Creation Screen. The UI should visually flag mandatory KPIs (set via Team Management) and leader-created challenges. Specifically, the UI needs to support:

* Full KPI visibility across all team members (likely via the drill-down on Team Dashboard).  
* Ability to create challenges that auto-enroll all or select team members.  
* Option to assign mandatory KPIs per user (via Team Management \- Flow 8), which cannot be removed from their logging screen.

### 2.6. Visual & Animation Design Goals

* Currency Themes:  
  * PC: Coin-style animations, "cha-ching" sound, meter counter.  
  * GP: Industrial gears, glowing city, click sound.  
  * VP: Growing tree, falling leaves, birdsong or natural ambiance.  
* Style Preference: Overall aesthetic should be clean, sleek, simple, and unbusy.  
* Logging Animations: Each KPI triggers currency-specific animation and sound. Growth meter visuals update in real-time. Growth Points (GP) and Vitality Points (VP) have tiered states (4 stages each) and decay states that visually reflect decline (desaturation, wilting, rust).  
* Challenge Leaderboards: Animate rank changes with bursts, flips, highlight bars; special animation for gaining/losing 1st place; progress bar or pie chart visual.  
* Overall Design Goals: Fun, rewarding feedback; accessible UI (aiming for WCAG 2.1 Level AA standards); swipeable and modular structure; distinct logic separation by currency; quick logging without clutter.

### 2.7. Deliverables

* Figma file with components, layouts, and exports for all screens, including variations for loading, empty, and error states.  
* Brand guidelines document (detailing logo usage, color palette, typography, and visual style \- if new branding is developed as part of the scope).  
* Marketing site (live or fully designed for handoff).  
* Visual specs for 5 animations (PC, GP, VP, GCI, Custom).

### 2.8. Ideal Candidate

* 3+ years of mobile app and site design experience.  
* Strong gamified/metric-driven UI experience.  
* Experience in brand identity development for digital products.  
* Proficiency with Figma \+ Webflow or Framer.  
* Familiarity with Flutter design handoff.  
* Understanding of accessibility design principles (e.g., WCAG).

## 3\. Developer Brief and Scope: Flutter App \+ Admin

### 3.1. Summary

The Flutter App \+ Admin Developer is responsible for building the cross-platform mobile and web application using Flutter, including an internal Admin Dashboard. This includes implementing all core features, integrating logging, animation, and challenge logic based on dynamic KPI inputs, and accurately displaying the Projected Commissions (PC) forecast and its associated confidence score.

### 3.2. Tech Stack & Platforms

* Framework: Flutter (Dart).  
* Platforms: iOS, Android, Web.  
* State Management: The Flutter developer will be responsible for selecting and implementing an appropriate state management solution (e.g., Provider, BLoC/Cubit, Riverpod, GetX, etc.) suitable for the app's complexity, ensuring maintainability, scalability, and testability.  
* Backend Integration: Supabase (preferred for flexibility and SQL support) or Firebase.  
* Authentication: Supabase Auth or Firebase Auth.  
* Database: Postgres (via Supabase – preferred).  
* Push Notifications: Firebase Messaging (preferred for sending; frontend handling detailed below).  
* Analytics: Firebase Analytics (preferred) or minimal custom logging.  
* Animations: Lottie animations are preferred over custom Flutter animations.

### 3.3. App Structure & Core Features (Implementation)

The Flutter Developer will implement the following core features and screens:

* Flutter App (iOS, Android, Web):  
  * Onboarding Flow: Capture user details (name, email, average price point, commission rate), goals (GCI Goal (next 365 days), Deals Closed Goal (next 365 days)), and team assignment.  
  * KPI Logging: For PC, GP, VP, Actual GCI (Deals Closed), Custom KPIs, and updating Pipeline Anchor statuses ("Listings Pending," "Buyers UC"). Logging triggers visual feedback (float-up, meter expansion) and haptic feedback. For KPIs configured to require direct value input (e.g., Actual GCI for "Deal Closed"), prompt for this value after the primary log.  
* Dashboards:  
  * Individual and team dashboards (implementing the detailed Team Dashboard layout as specified in 2.3).  
  * Display PC (90-day projection for individual, aggregated for team), GP, VP meters.  
  * Display Actual GCI and Deals Closed (individual and aggregated for team).  
  * Implement the PC projection line graph showing future PC.  
  * Display the Forecast Confidence Meter/Score (e.g., as a color-coded overlay on the PC graph or a separate gauge) based on the score provided by the backend.  
  * Display contextual coaching messages related to forecast confidence.  
  * Visual decay if no recent activity for GP/VP (as per original plan, PC decay is handled by backend logic).  
* Challenge System: Multi-KPI logging, percentage complete tracking, team leaderboard, and challenge invitation.  
* Subscription Management: Tiered access and feature locking.  
* Coaching Promotion Screen: Display custom banners linking to coaching resources; display dynamic coaching messages from backend.  
* Tier-Restricted Feature Handling: Implement a consistent mechanism for displaying features that are locked based on the user's current subscription tier. These features should appear greyed out or visually locked. Interacting with (e.g., tapping) a locked feature should navigate the user to the "Subscription & Tiers Screen" to facilitate an upgrade. This applies to functionalities like creating custom challenges, accessing team features for solo users, exceeding KPI limits for free users, etc.  
* Implement robust handling and display of loading states (e.g., for data fetching), empty states (e.g., no challenges available), and error states (e.g., network errors, validation errors) based on the UI/UX designs detailed in Section 2.3.1.  
* Offline Capabilities:  
  * Implement local caching to allow users to view their last loaded dashboard data (PC, GP, VP, etc.) when offline (read-only).  
  * Enable offline logging of KPIs (PC, GP, VP, Custom). Offline logs should be stored locally and automatically synced to the backend when an internet connection is available. The UI should indicate offline status and any pending sync operations. For PC KPIs, the main PC meter will update post-sync; GP/VP meters can reflect local offline logs immediately.  
  * Complex actions like creating/joining teams or challenges, and subscription management will require an online connection.  
*  **Sponsored Challenges (Implementation)**  
  * The Sponsored Challenge module enables users to browse and join challenges that are sponsored by external entities (e.g., lenders, vendors). These challenges include branding, rewards, and optional CTAs.  
  * **Frontend Implementation Requirements:**  
* **Sponsored Challenge Showcase Screen**:  
  * Pulls a scrollable list of active sponsored challenges from the backend.  
  * Each entry displays sponsor branding, reward summary, challenge name, and a “Join” CTA.  
  * Include clear visual differentiation from standard challenges (e.g., “Sponsored” ribbon or frame).  
* **Sponsored Challenge Detail Screen**:  
  * Show sponsor logo, full challenge description, KPIs, reward details, sponsor disclaimer, and external CTA button.  
  * Include a Join Challenge button identical to the standard challenges.  
  * If the user has already joined, reflect their % completion and progress data.  
* **CTA Integration**:  
  * If the sponsor provides a URL (e.g., to book a call), the CTA should open in an external browser or an in-app web view.  
  * Track the tap event (for internal analytics only).  
* **Challenge Participation**:  
  * Joining a sponsored challenge should work identically to joining standard challenges.  
  * The app must store and send the sponsored\_challenge\_id during log sync.  
* **Tier Enforcement**:  
  * Sponsored challenges may be restricted by tier (e.g., Teams or higher).  
  * If a user attempts to join a restricted sponsored challenge, show standard upgrade flow.  
* **Branded UI Elements**:  
  * Sponsored challenges must include branded headers or frames that match the sponsor’s logo/colors while maintaining UI consistency.  
  * Use a “Sponsored” tag or badge clearly.

✅ **Impacts the following areas**:

* Challenge Selection  
* Challenge View  
* Dashboard (for joined challenge display)  
* API (Sponsored Challenge endpoints \+ Join flow)  
* Push Notifications (optional for sponsor reminder prompts)


* #### 3.3.1. Push Notification Handling (Frontend)   The Flutter app must effectively handle receiving and displaying various types of push notifications sent from the backend via services like Firebase Cloud Messaging (FCM).

  * Types of Notifications: Includes Challenge Notifications (starting soon, milestone achieved, ending soon, completed, leaderboard changes), Coaching Messages/Performance Insights, (Optional) Team Activity Summaries, and (Opt-in) Promotional Announcements.  
  * Receiving Notifications: Implement robust listeners for push notifications when the app is in the foreground, background, or terminated.  
  * Display When App in Foreground: Display notifications as a subtle in-app banner or alert (e.g., at the top of the screen) to avoid disrupting the user's current flow. This banner should be dismissible and may include relevant action buttons (e.g., "View Now").  
  * Display When App in Background/Terminated: Utilize standard system notifications (banners, lock screen alerts, notification center entries) with the app icon, a clear title, and a concise message.  
  * User Interaction (Deep-Linking): When a user taps on any push notification (system-level or in-app banner), the app must open and navigate the user to the most relevant screen or content. Examples:  
    * Challenge Notification → Specific Active Challenge View or Challenge Results Screen.  
    * Coaching Message → Individual Dashboard (potentially highlighting relevant section) or dedicated "My Coaching" message area.  
    * Team Notification → Team Dashboard.  
  * Respect User Preferences: Adhere to the user's notification settings (as configured in Flow 10, Step 6\) for enabling/disabling different categories of notifications.  
  * App Icon Badge Counts (Optional): Consider implementing app icon badging for critical unread notifications (e.g., new coaching messages, important challenge alerts). Define rules for incrementing and clearing the badge.  
  * Notification History/Inbox (Recommended): Provide a way for users to view a history of important notifications or messages they might have missed (e.g., within the "My Coaching" section or a dedicated "Notifications" inbox in Settings).  
* Flutter Web-based Admin Dashboard (for Super Admins):  
  * Manage Master KPIs (create, edit, enable/disable \- Flow 15).  
  * Manage Challenge Templates (create, edit, enable/disable \- Flow 16).  
  * View System Analytics & User Overview (Flow 17):  
    * Display key system metrics (active users, registrations, subscription breakdown, KPI logging activity, challenge engagement).  
    * User list with search, filter, and view individual user details (read-only summary, role/tier management, account status management).  
    * Manually add new users with initial password and tier assignment.  
    * Provide functionality to export key data sets (e.g., User List, KPI Logs, Challenge Participation) to CSV/Excel format.  
    *  Display more detailed, pre-defined reports (e.g., subscription trends, KPI popularity, challenge completion rates).  
  * Connect front-end to Firebase/Supabase backend.  
  * Integrate UI animations and Figma assets (if any specific to admin dashboard).  
  * Ensure responsive layouts for all devices.

### 3.4. KPI Engine Logic (Implementation \- Frontend)

* Currencies:  
  * PC (Projected Commissions): The frontend will primarily display the total PC value (90-day focus for individual) and the future projection line graph as calculated and provided by the backend. It does not calculate PC itself.  
  * GP (Growth Points): Implement accumulation based on GP KPI values. Implement decay after 2-week inactivity.  
  * VP (Vitality Points): Implement accumulation based on VP KPI values. Implement decay if no log after grace period.  
  * Actuals: Log Deals Closed (counter \+ linked GCI value). Actual GCI is sent to backend.  
  * Custom KPIs: Log for personal tracking or challenge use; use generic animation.  
  * Pipeline Anchors: Allow users to log/update the current count for "Pipeline Anchor: Listings Pending" and "Pipeline Anchor: Buyers UC". These counts are sent to the backend.  
* KPI Logging with Value Input: For KPIs like "Deal Closed" that require an additional value (e.g., GCI amount), the UI must prompt for this input immediately after the primary logging action.  
* Forecast Confidence Display:  
  * Fetch and display the overall Forecast Confidence Score (0-100%) from the backend.  
  * Visually represent this score (e.g., color-coding the PC projection graph Green/Yellow/Red, displaying a confidence gauge).  
  * Display coaching messages received from the backend related to forecast confidence.

### 3.5. Challenge Logic (Implementation)

* Implement 10 predefined challenge templates.  
* Support user participation in challenges based on their plan (Solo: 1 active predefined; Team: unlimited predefined/custom).  
* Integrate individual vs. team logic for leaderboards, including contribution % for team goals.  
* Ensure challenge activity contributes to meter growth (PC, GP, VP as applicable).  
* Implement custom challenge creation for Teams Package users.  
* Track challenge progress and leaderboard in real-time.

### 3.6. Animations (Implementation)

* Implement 5 types of animations: PC (dollar float/coin flip), GP (gear click/city expansion), VP (tree growth/vitality pulse), GCI (deal closed stamp/milestone ping), Custom KPI (neutral pulse/soft sparkle).  
* Custom KPIs must trigger their own animation.  
* Meter fill logic for smooth growth per tap (for GP, VP; PC meter reflects backend calculation).  
* Challenge leaderboard transitions.  
* Haptics \+ Sound linked to each tap (Lottie-ready files preferred).

### 3.7. Deliverables

* Fully functioning app (mobile \+ web).  
* Flutter-based admin dashboard.  
* KPI logging with visual feedback.  
* Animation and interaction layer.  
* Sync to backend with confidence engine logic display.  
* Source code (Flutter) connected to backend.  
* Published to iOS \+ Android stores.  
* Link to staging web version.

### 3.8. Ideal Candidate

* 3+ years Flutter experience.  
* Strong with cross-platform, Firebase-connected apps.  
* Comfortable with dynamic UI and user-configurable data structures.  
* Bonus: Experience with gamified or productivity apps.

## 4\. Backend Brief and Scope: Firebase or Supabase

### 4.1. Purpose

The Backend Developer is responsible for building and managing a secure, scalable backend infrastructure. The backend must handle all KPI logic (especially the dynamic PC calculation, decay, and forecast confidence scoring), real-time sync, team dynamics, challenge systems, billing and subscription management, permissions across various subscription tiers, and provide robust support for the Admin Panel.

### 4.2. Stack & Hosting

* Preferred: Supabase (for flexibility and SQL support) or Firebase \+ Google Cloud Functions / Node.js \+ PostgreSQL.  
* Hosting: Firebase / Google Cloud Platform.  
* Authentication: Firebase Auth (email \+ OAuth), JWT for API security. Super Admin roles must be strictly enforced for admin panel access.  
* Payment Gateways: Integration with Stripe (for web subscriptions) and Apple App Store In-App Purchases / Google Play Billing (for mobile subscriptions) will be required.

### 4.3. Core Data Models

The backend must support the following data models:

* Users: ID, name, email, onboarding info (average price point, commission rate), goal\_gci\_365\_days, goal\_deals\_closed\_365\_days, selected KPIs, challenge participation, role (individual, team member, team leader, super\_admin), tier, current\_subscription\_id (links to Subscriptions table), last\_activity\_timestamp (timestamp of the last KPI log), account\_status: string (e.g., "active", "deactivated").  
* Subscriptions: Subscription\_ID, User\_ID, Plan\_ID (e.g., "free", "basic\_solo", "teams\_monthly", "teams\_annual"), Gateway\_Subscription\_ID (from Stripe/Apple/Google), Start\_Date, End\_Date (or Next\_Renewal\_Date), Status (e.g., "active", "past\_due", "canceled", "trial"), Auto\_Renew (boolean).  
* KPIs:  
  * ID: Unique identifier for the KPI.  
  * Name: User-facing name of the KPI.  
  * Type: PC, GP, VP, Custom, Actual, Pipeline\_Anchor.  
  * PC\_Weight\_Percent: (For PC Type) The percentage weight used in PC calculation.  
  * TTC\_Definition: (For PC Type) Time-To-Commission period (e.g., "30 days," "60-90 days").  
  * Post\_TTC\_Decay\_Duration\_Days: (For PC Type) Days for linear decay post-TTC (e.g., 180 days).  
  * GP\_Value: (For GP Type) Points awarded.  
  * VP\_Value: (For VP Type) Points awarded.  
  * Requires\_Direct\_Value\_Input: Boolean (True for "Deal Closed" to prompt for GCI).  
  * Secondary\_Input\_Prompt: String (e.g., "Enter GCI Amount" \- for KPIs where Requires\_Direct\_Value\_Input is true).  
  * Icon\_Reference, Animation\_Reference, Category, Is\_Enabled.  
  * (Other attributes like Description, Widget\_Availability, Leaderboard\_Eligibility as needed).  
* KPI\_Logs: User\_ID, KPI\_ID, Timestamp, Logged\_Value (e.g., for Actual GCI, or the quantity from a "log with quantity" action if implemented), associated PC\_Generated (at time of logging, for PC KPIs), current\_PC\_Contribution (after decay, for PC KPIs), TTC\_End\_Date, Decay\_End\_Date.  
* Pipeline\_Anchor\_Status: User\_ID, Anchor\_Type (Listings\_Pending, Buyers\_UC), Current\_Count, Timestamp.  
* Challenges: (Data model for active challenge instances) Challenge\_Instance\_ID, Template\_ID (if based on template), Custom\_Challenge\_Name (if custom), User\_ID (for solo) or Team\_ID (for team), Start\_Date, End\_Date, Status (active, completed, ended).  
* Challenge\_Templates: Template\_ID, Name, Description, Goal\_Description, Default\_Duration\_Days, Associated\_KPI\_IDs, Predefined\_Label\_Icon, Default\_Mode, Is\_Enabled.  
* Challenge\_Participants: Challenge\_Instance\_ID, User\_ID, Join\_Date, Progress\_Data (specific to KPIs in the challenge). Challenge\_Participants:- sponsored\_challenge\_id (UUID, nullable)  ← \[NEW\]  
* Teams: Team ID, name, members (User\_IDs), leader(s) (User\_IDs), permissions, team-level progress.  
* Forecast\_Confidence\_Data: User\_ID, Timestamp, Historical\_Accuracy\_Ratio, Pipeline\_Health\_Ratio\_45day, Inactivity\_Flag\_Days (days since last activity), Overall\_Confidence\_Score (0-100%), associated Coaching\_Message\_ID.  
* Leaderboard Data: Structure to store and query leaderboard information for challenges.  
* Coaching & Subscriptions (Meta): Assigned coach or org, scheduled sessions, tier-level feature permissions definition.  
* Admin\_Activity\_Log: Log of significant actions performed by Super Admins (e.g., KPI changes, user role changes).  
* Sponsors:  
  * \- sponsor\_id (UUID, PK)  
  * \- name (string)  
  * \- logo\_url (string)  
  * \- website\_url (string, optional)  
  * \- cta\_text (string, optional)  
  * \- cta\_link (string, optional)  
  * \- disclaimer\_text (text)  
  * \- is\_active (boolean)  
* Sponsored\_Challenges:  
  * \- sponsored\_challenge\_id (UUID, PK)  
  * \- sponsor\_id (FK to Sponsors)  
  * \- name (string)  
  * \- description (text)  
  * \- reward\_details (text)  
  * \- cta\_text (string, optional)  
  * \- cta\_link (string, optional)  
  * \- start\_date (timestamp)  
  * \- end\_date (timestamp)  
  * \- is\_enabled (boolean)  
  * \- tier\_required (string: "free", "basic", "teams", etc.)  
  * \- associated\_kpi\_ids (array of FK to KPIs)

### 4.4. Role-Based Access

(As per original plan \- Individual, Team Member, Team Leader, Super Admin permissions. Super Admin access is required for all Admin Panel functionalities).

### 4.5. Logging & Data Handling

* Log API must support all KPI types. For PC KPIs, it calculates and stores initial PC\_Generated and sets TTC\_End\_Date and Decay\_End\_Date. When any KPI is logged, update User.last\_activity\_timestamp.  
* Log API must support receiving and storing the Logged\_Value for KPIs that require direct value input (e.g., Actual GCI for "Deal Closed").  
* The backend must be prepared to handle incoming logs that may have been queued offline and synced in batches, ensuring data integrity and correct timestamping (using the original offline log time).  
* Handle currency-specific animations via response metadata.  
* Support per-log coaching triggers.  
* Respect mandatory KPIs (non-removable in user logs).  
* Sync across devices (Firebase real-time DB or Firestore preferred).  
* Custom KPIs are excluded from PC/GP/VP currency earnings, loggable and tracked in relation to outcomes, allowed in challenge structures and activity logs, and must store currency-neutral metadata, timestamps, and references.  
* Store logs of Pipeline Anchor status updates.  
* Data for deactivated accounts is retained to allow for future reactivation (Flow 14), but is not processed or publicly visible while account\_status is "deactivated". The app's privacy policy must detail this retention and user rights regarding their data.

### 4.6. Forecast Engine Logic (Implementation \- Backend)

(As per previous detailed update \- covering PC calculation, decay, and Forecast Confidence Score).

### 4.7. Challenge Engine Logic (Implementation)

* Assign KPIs to challenges (using KPI IDs from the updated Master KPI list).  
* Track per-user progress and point accumulation (PC, GP, VP based on KPI type) within the context of a challenge instance.  
* Enforce team leader rules (forced enrollment, mandatory KPIs).  
* Calculate and provide data for challenge leaderboards, including contribution percentages for team goals.  
* Handle logic for individual vs. team goals within challenges.  
* Process late additions to challenges, including optional inclusion of prior KPI logs based on challenge maker's decision.  
* Trigger notifications related to challenge lifecycle events (start, milestones, end).

#### 4.7.1. Billing Integration and Subscription Management Logic

The backend must handle all aspects of subscription management and billing integration with chosen payment gateways (Stripe for web, Apple IAP & Google Play Billing for mobile).

1. Payment Gateway Integration:  
   * Implement server-side integration with Stripe API for web-based subscriptions.  
   * Implement server-side validation of receipts from Apple App Store IAP and Google Play Billing for mobile subscriptions.  
2. Subscription Lifecycle Management:  
   * Creation: Securely process new subscription requests, create subscription records in the local database, and link them to user accounts and payment gateway subscription IDs.  
   * Upgrades/Downgrades: Handle logic for changing subscription tiers, including potential pro-ration calculations (if supported/offered) and updating billing cycles with gateways.  
   * Renewals: Process renewal events (successful or failed) received from payment gateways via webhooks.  
   * Cancellations: Process cancellation requests. Subscriptions should typically remain active until the end of the current paid period. Ensure auto-renewal is stopped at the gateway.  
   * Payment Failures & Dunning:  
     * Implement logic to handle payment failure notifications from gateways.  
     * Support a grace period (e.g., 3-7 days) during which users retain access while payment is retried by the gateway.  
     * Trigger notifications to users regarding payment issues.  
     * If payment is not resolved after the grace period and dunning attempts, automatically downgrade the user to the "Free" tier or restrict access to paid features.  
   * Trial Periods (If Implemented): Backend logic to manage trial start/end dates, conversion to paid plans, or expiry of access.  
3. Secure Payment Tokenization:  
   * Adhere to PCI compliance by ensuring no sensitive credit card details are stored on the application servers. Utilize tokens provided by payment gateways (e.g., Stripe tokens).  
4. Webhook Handling:  
   * Implement robust and secure webhook endpoints to receive and process asynchronous notifications from Stripe, Apple, and Google for events such as:  
     * invoice.payment\_succeeded  
     * invoice.payment\_failed  
     * customer.subscription.updated  
     * customer.subscription.deleted (cancelled)  
     * charge.refunded  
     * charge.dispute.created  
     * Equivalent events from Apple IAP and Google Play Billing.  
   * Ensure webhook processing is idempotent and secure.  
5. Tier Enforcement & Entitlement Management:  
   * Maintain an accurate record of each user's current subscription tier and access rights.  
   * API endpoints for features restricted by tier must validate the user's current entitlements before granting access.  
6. Receipts and Invoicing:  
   * For web subscriptions (Stripe), configure Stripe to send receipts/invoices, or implement custom receipt generation if necessary.  
   * For mobile IAPs, Apple/Google manage receipt delivery to users.  
7. Refunds and Disputes:  
   * Provide mechanisms or administrative processes to handle refund requests in coordination with payment gateway policies.  
   * Track and manage payment disputes (chargebacks).  
8. Synchronization: Ensure subscription status is accurately synchronized if users can subscribe/manage subscriptions via multiple platforms (e.g., web and mobile).

### 4.8. Admin Panel Functionality (Web Only \- Backend Support)

The backend must provide secure (Super Admin role-restricted) API endpoints and logic to support the following Admin Panel functionalities:

1. Master KPI Catalog Management (supports Flow 15):  
   * GET /admin/kpis: List all master KPIs with pagination, filtering (by type, status), and sorting.  
   * POST /admin/kpis: Create a new master KPI (PC, GP, VP, Custom, Actual, Anchor) with all its attributes (name, type, weights, TTC, decay, points, icon/animation refs, enabled status, etc.).  
   * GET /admin/kpis/{kpiId}: Get details of a specific master KPI.  
   * PUT /admin/kpis/{kpiId}: Update an existing master KPI.  
   * PATCH /admin/kpis/{kpiId}/status: Enable/disable a master KPI.  
   * DELETE /admin/kpis/{kpiId}: Delete a master KPI (with strict checks for dependencies if implemented, otherwise prefer disable).  
2. Challenge Template Management (supports Flow 16):  
   * GET /admin/challenge-templates: List all challenge templates with pagination and filtering.  
   * POST /admin/challenge-templates: Create a new challenge template (name, description, duration, associated KPIs, label/icon, mode, enabled status).  
   * GET /admin/challenge-templates/{templateId}: Get details of a specific template.  
   * PUT /admin/challenge-templates/{templateId}: Update an existing template (changes apply to new challenge instances).  
   * PATCH /admin/challenge-templates/{templateId}/status: Enable/disable a template.  
   * DELETE /admin/challenge-templates/{templateId}: Delete a template (with consideration for historical context).  
3. System Analytics & Usage Statistics (supports Flow 17):  
   * GET /admin/analytics/overview: Endpoint to fetch aggregated data for dashboard widgets (total users, new users, active users DAU/MAU, subscription breakdown, overall KPI logging volume, active challenges). Requires efficient aggregation queries.  
   * GET /admin/analytics/detailed-reports: Endpoints for more specific reports (e.g., KPI usage trends, challenge completion rates, user retention/churn \- if built-in reports are desired beyond basic CSV export).  
4. User Management (supports Flow 17):  
   * GET /admin/users: List all users with pagination, search (by name, email), and filtering (by tier, status, team).  
   * POST /admin/users: Manually create a new user account (name, email, initial password, role, tier, optional financial inputs, optional team assignment). Backend should flag user for password change on first login.  
   * GET /admin/users/{userId}: Get detailed overview of a specific user (profile, tier, status, team, high-level activity summary).  
   * PUT /admin/users/{userId}/role: Change a user's role.  
   * PUT /admin/users/{userId}/tier: Change a user's subscription tier (for comping or administrative adjustments).  
   * PUT /admin/users/{userId}/status: Change a user's account status (e.g., activate, deactivate).  
5. Data Export Functionality (supports Flow 17):  
   * POST /admin/data-exports: Endpoint to initiate generation of data exports.  
     * Request body specifies data type (e.g., "kpi\_logs," "user\_list," "challenge\_participation"), date ranges, filters, and desired fields.  
     * Backend generates the CSV/Excel file and provides a secure download link or streams the file. This may involve background job processing for large datasets.  
6. Sponsored Challenge Management :  
   * Endpoints to create, review, approve/reject, and manage sponsored challenge content.  
7. Content Management for Coaching/Notifications (If Centralized):  
   * Endpoints for Super Admins to manage a library of coaching messages or templates for system-wide notifications if not hardcoded.  
8. Audit Logging:  
   * Backend should automatically log significant actions performed by Super Admins (e.g., creating/editing KPIs, changing user roles/tiers) into an Admin\_Activity\_Log for security and accountability.

### 4.9. Deliverables

* Fully structured DB and endpoint layer, including secure Admin API endpoints.  
* Cloud functions or triggers for PC projection, decay, and confidence score calculation.  
* Robust backend integration with specified payment gateways (Stripe, Apple IAP, Google Play Billing), including webhook handlers for subscription lifecycle events.  
* Admin support logic (e.g., CRUD operations for KPIs/templates, data aggregation for analytics, data export generation).  
* Integrated billing logic and tier enforcement for feature access.  
* Secure role-based access and user team linkage.

### 4.10. Ideal Candidate

* 3+ years backend experience with Firebase or Supabase.  
* Strong grasp of real-time data sync, cloud functions, auth models.  
* Demonstrable experience integrating with payment gateways like Stripe, Apple IAP, and Google Play Billing, including webhook handling and subscription lifecycle management.  
* Experience with SaaS billing integrations (Stripe, Apple/Google IAP).  
* Bonus: Experience with metric-tracking, CRM, or productivity platforms.

## ---

**5\. Data Sets & Supporting Information**

### 5.1. Master Projected Commissions (PC) KPI List & Attributes

The following table details the KPIs that generate Projected Commissions (PC). The PC generated by each logged event is calculated as:  
PC Value \= User's Average Price Point × User's Commission Rate × KPI's PC % Weight.  
Each PC contribution remains at full value during its TTC period, after which it decays linearly to zero over its "Post-TTC Decay Duration."

Canonical KPI catalog source (all types, current):  
- Human-readable: `docs/spec/appendix/KPI_MASTER_CATALOG_CANONICAL.md`  
- Machine-readable: `docs/spec/appendix/kpi_master_catalog.json`

The canonical catalog supersedes ad hoc KPI examples in this document for implementation parity. This section remains the conceptual definition of PC math and operational rules.

| KPI Name | PC % Weight | $ Value @ $100K PC (Example) | Time to Commission (TTC) | Post-TTC Decay Duration | Notes |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Phone Call Logged | 0.025% | $25 | 90–120 days | 180 days |  |
| Sphere Call | 0.04% | $40 | 60–90 days | 180 days |  |
| FSBO/Expired Call | 0.05% | $50 | 30–60 days | 180 days |  |
| Door Knock Logged | 0.03% | $30 | 90–150 days | 180 days |  |
| Appointment Set (Buyer) | 0.5% | $500 | 30–60 days | 180 days |  |
| Appointment Set (Seller) | 0.5% | $500 | 30–60 days | 180 days |  |
| Coffee/Lunch with Sphere | 0.1% | $100 | 90–150 days | 180 days |  |
| Conversations Held | 0.1% | $100 | 90–150 days | 180 days | (New) |
| Listing Taken | 7.0% | $7,000 | 30 days | 180 days |  |
| Buyer Contract Signed | 5.0% | $5,000 | 30 days | 180 days |  |
| New Client Logged | 1.25% | $1,250 | 30–90 days | 180 days |  |
| Text/DM Conversation | 0.01% | $10 | 90–120 days | 180 days |  |
| Open House Logged | 0.2% | $200 | 60–120 days | 180 days |  |

**Actuals & Pipeline Anchors (Status Tracking for Forecasting):**

| Item Name | Role | PC % Weight | TTC / Relevance Window | Post-TTC Decay Duration | Notes |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Deal Closed | Logs Actual GCI; Calibrates Forecast Confidence | (No PC Weight) | Immediate | N/A | Requires GCI value input |
| Pipeline Anchor: Listings Pending | Logged status/count for PC forecasting; Influences Forecast Confidence (Pipeline Health component) | (No PC Weight) | 30 days (for forecast influence) | N/A |  |
| Pipeline Anchor: Buyers UC | Logged status/count for PC forecasting; Influences Forecast Confidence (Pipeline Health component) | (No PC Weight) | 30 days (for forecast influence) | N/A |  |

Selection Rule Note:
- `Deal Closed` and `Pipeline Anchor` items are operational logging inputs and must not appear in user KPI selection catalogs for onboarding or KPI management.
- `Listing Taken` remains a selectable `PC` KPI.

GP and VP master KPI lists are now explicitly defined in the canonical KPI catalog files above (including names, slugs, type assignment, and icon references). Point values may remain `TBD` in spec-source records until finalized, but category assignment and catalog membership should be treated as canonical from the catalog files.

### 5.2. Challenge Templates

(As per original plan \- list of 10 Challenge Templates and their associated KPIs from the original document's Section 5.2. Ensure KPI names used here match the updated Master KPI list, and each template has a predefined Label/Icon.)

* New Client Challenge  
* Pipeline Challenge  
* Regular Rhythm Challenge  
* Seasonal Challenge  
* Mindset & Resilience Challenge  
* Social Influence Challenge  
* Conversion Mastery Challenge  
* Listing Machine Challenge  
* Referral Engine Challenge  
* Systems & Automation Challenge

**Sponsored Challenges (Dynamic Challenges Managed via Admin Panel)**

Sponsored Challenges are not seeded like standard templates. They are created by Super Admins and may be funded or promoted by external partners (e.g., lenders, tech vendors, title reps). Key differences:

* **Dynamic Nature**: Created through the Admin Panel. Not part of the static 10 challenge templates.  
* **Sponsor Branding**: Each challenge includes sponsor name, logo, optional CTA link, and reward/prize info.  
* **CTA Links**: Optional “Book a Call,” “Visit Website,” or similar action that opens in-app or external browser.  
* **Reward Descriptions**: Textual only. Prizes are administered by the sponsor, not the app.  
* **KPI Eligibility**: Must only include KPIs from the Master KPI Catalog.  
* **Tier Controls**: Admins may restrict participation to specific tiers (e.g., Teams only).  
* **Visibility**: Only visible when active and enabled.

### 5.3. Initial Data Seeding Plan

To ensure the application is functional and provides a good out-of-the-box experience, the following data must be seeded into the database upon initial deployment:

1. **Master KPI Catalog:**  
   * Seed from the canonical KPI catalog sources:
     * `docs/spec/appendix/KPI_MASTER_CATALOG_CANONICAL.md` (human-readable governance record)
     * `docs/spec/appendix/kpi_master_catalog.json` (machine-readable implementation source)
   * Catalog must include and preserve category assignment for:
     * Projected Commissions KPIs (`Type: "PC"`) with PC\_Weight\_Percent + TTC/decay definitions
     * Growth Points KPIs (`Type: "GP"`) with GP point values (or explicit TBD placeholders in spec source until finalized)
     * Vitality Points KPIs (`Type: "VP"`) with VP point values (or explicit TBD placeholders in spec source until finalized)
     * Operational items: `Deal Closed` (`Type: "Actual"`) and pipeline anchors (`Type: "Pipeline_Anchor"`)
   * Selection rule remains unchanged: `Deal Closed` and `Pipeline Anchor` items must not appear in user KPI selection catalogs for onboarding or KPI management.
2. **Challenge Templates:**  
   * The 10 predefined challenge templates as outlined in Section 5.2.  
   * Each template needs to be seeded with its:  
     * Template Name  
     * Description  
     * Goal Description  
     * Default Duration (in days)  
     * A list of associated Master KPI IDs that make up the challenge.  
     * A Predefined Label/Icon reference.  
     * Default Mode (e.g., Solo, Team, User Selectable \- if this varies per template).  
     * IsEnabled status (typically true).  
3. **Initial Super Admin Account(s):**  
   * At least one Super Admin user account should be created as part of the deployment/seeding process to allow for initial system configuration and management. Credentials should be securely handled and communicated.

The backend developer will be responsible for creating the necessary scripts (e.g., SQL migrations, seed files) to populate this data.

---

6\. Key Project Interdependencies

Understanding the dependencies between the different roles (UI/UX Designer, Flutter App Developer, Backend Developer) is crucial for efficient project execution and timeline management.

### 6.1. Dependencies for UI/UX Designer:

* From Project Owner:  
  * Initial project vision, goals, and target audience (largely covered in this document).  
  * Clarification on branding (now defined as designer-led, based on preferences).  
  * Primary copy for the marketing website.  
  * Feedback on wireframes (if created) and design mockups.  
  * Confirmation of user flows.  
* From Backend Developer (Potentially, for complex data display):  
  * Understanding of data structures that need to be visualized (e.g., for complex dashboards or admin views, though typically design leads here).

### 6.2. Dependencies for Flutter App Developer:

* From UI/UX Designer:  
  * Finalized UI Designs & Assets: Complete Figma files (or equivalent) with all screens, components, states (loading, empty, error), and visual assets (icons, images). This is a primary blocker.  
  * Animation Specifications: Lottie files or detailed visual specs for all required animations.  
  * Brand Guidelines: If new branding is developed by the designer.  
  * User Flow Diagrams: To understand navigation and interaction logic.  
* From Backend Developer:  
  * Defined API Contract: Stable API endpoints, request/response payloads, and error codes for all backend interactions (user auth, KPI logging, fetching dashboard data, challenges, etc.). This is a primary blocker for many frontend features.  
  * Functional Backend Endpoints: Access to a working development/staging backend environment for integration and testing.  
  * Push Notification Setup: Configuration details for receiving push notifications (e.g., FCM setup on backend).  
* From Project Owner:  
  * Clarification on any ambiguous features or user stories.  
  * Access to test accounts or any necessary platform credentials (e.g., for app store deployment).

### 6.3. Dependencies for Backend Developer:

* From Project Owner / This Document:  
  * Core Logic Definitions: Detailed PC calculation logic, decay rules, Forecast Confidence algorithm, KPI definitions, challenge rules, subscription tier features, admin panel requirements. (Largely covered in this document).  
  * Data Models: Definitions for users, KPIs, challenges, teams, etc. (Largely covered).  
  * Initial Data Seeding Plan: List of KPIs, challenge templates to be pre-loaded.  
* From UI/UX Designer (Less direct, but influential):  
  * Understanding of what data needs to be displayed on various screens can inform API design (e.g., what data the /users/me/dashboard-data endpoint needs to return).  
* From Flutter App Developer (For Integration):  
  * Feedback on API usability and any issues encountered during integration.  
  * Understanding of data required by the frontend for specific views or push notification payloads.

### 6.4. General Dependencies:

* Communication: Regular communication and collaboration between all three roles and the Project Owner are essential to resolve ambiguities, manage changes, and ensure alignment.  
* Testing & Feedback Cycles: Each role will depend on feedback from others and the Project Owner at various stages (e.g., design reviews, API testing, app testing).

This section provides a high-level overview. Specific task-level dependencies will emerge during detailed sprint planning if an agile methodology is used.

---

## 

## **Modular Insert \#5: User Flow, Figma, and API Update Flags – Sponsored Challenges**

### **User Flow Diagrams – Additions**

**New Sponsored Challenge Flow:**

\[Home or Challenge Tab\]

    ↓

\[Sponsored Challenge Showcase\]

    ↓ (Tap on Challenge)

\[Sponsored Challenge Detail\]

    ↓

\[Join Challenge\] → Confirms participation (backend call)

    ↓

\[Active Challenge View\] (shows progress, % complete)

Optional Branch:

    ↓ (Tap CTA)

\[External CTA Link\] (opened via in-app or system browser)

**Optional Branch for Notification Flow (future):**

\[Push Notification: "New Sponsored Challenge"\]

    ↓

\[Opens Sponsored Challenge Detail View\]

### **Figma Mockups – New Screens or Elements**

Add the following to the UI/UX scope:

1. **Sponsored Challenge Showcase Screen**  
   * Carousel or list of sponsored challenges  
   * “Sponsored” badge or border  
   * Preview: logo, reward blurb, Join button  
2. **Sponsored Challenge Detail Page**  
   * Banner with sponsor logo  
   * Full challenge description  
   * Reward display  
   * CTA button with link  
   * Disclaimer section  
   * Join Challenge button  
3. **CTA Tap Confirmation or Flow**  
   * Open CTA in in-app browser or external tab  
   * UI feedback for “Leaving the app” (if needed)  
4. **Challenge List Enhancements**  
   * Indicate which challenges are sponsored  
5. **Dashboard Card (Optional)**  
   * If user is in a sponsored challenge, a callout or badge can appear on their dashboard challenge module  
6. **Admin Panel (Web)**  
   * Sponsor creation screen (logo upload, CTA entry, disclaimer)  
   * Sponsored Challenge creation screen (tie sponsor \+ challenge KPIs \+ reward \+ tier visibility)

### **API Contracts – Additions & Modifications**

**New Endpoints:**

GET    /sponsored-challenges                  ← for end users

GET    /sponsored-challenges/{id}            ← detail view

POST   /challenge-participants (add support for sponsored\_challenge\_id)

**Admin Panel Endpoints:**

GET    /admin/sponsors

POST   /admin/sponsors

PUT    /admin/sponsors/{id}

PATCH  /admin/sponsors/{id}/status

DELETE /admin/sponsors/{id}

GET    /admin/sponsored-challenges

POST   /admin/sponsored-challenges

PUT    /admin/sponsored-challenges/{id}

PATCH  /admin/sponsored-challenges/{id}/status

DELETE /admin/sponsored-challenges/{id}

**Data Model Adjustments:**

* Add sponsored\_challenge\_id to challenge\_participants  
* Add full sponsor model and sponsor-challenge linkage

---

## 7\. Definition of Done (DoD)

This section outlines the criteria for considering different aspects of the project "done."

### 7.1. Definition of Done for this Project Plan Document

This "KPI Tracker App Project Plan" document is considered "done" and ready for handover to prospective designers and developers when:

* \[x\] All sections (1 through 8, including all subsections) have been reviewed and approved by the Project Owner.  
* \[x\] Key project objectives and the overall vision are clearly articulated (Section 1).  
* \[x\] Scope and deliverables for the UI/UX Designer, Flutter App Developer, and Backend Developer are clearly defined and understood by the Project Owner (Sections 2, 3, 4).  
* \[x\] Core application features, including the PC, GP, VP systems, KPI logging, challenge mechanics, and forecast confidence logic, are sufficiently detailed for initial understanding and estimation (Sections 3.4, 4.6, 4.7, User Flows).  
* \[x\] Key data models and data sets (especially PC KPIs, Challenge Templates) are defined (Sections 4.3, 5.1, 5.2, 5.3).  
* \[x\] Key User Flows (for users, team leaders, and super admins) have been outlined and reviewed (User Flow Document kpi\_user\_flows\_v1).  
* \[x\] Initial technical considerations (stack, platforms) have been stated (Sections 3.2, 4.2).  
* \[x\] Critical project interdependencies have been identified (Section 6).  
* \[x\] Key project assumptions have been listed and reviewed (Section 8).  
* \[ \] The Project Owner confirms this document provides a sufficient basis for vendors to estimate effort and begin initial design/development planning. (Final check by you\!)

### 7.2. General Definition of Done for Design Deliverables (Guideline for Designer)

Individual design deliverables (e.g., wireframes for a flow, high-fidelity mockups for a screen, brand guidelines) might be considered "done" when:

* All screen requirements for the specific feature/flow are addressed.  
* Designs align with the defined User Flows.  
* Branding (if developed by designer) is consistently applied.  
* Considerations for loading, empty, and error states are included.  
* Accessibility standards (WCAG 2.1 Level AA) have been considered in the design.  
* All assets are provided in the agreed-upon format (e.g., Figma files, organized and clearly named).  
* Designs have been reviewed and approved by the Project Owner.  
* Responsive variations (if applicable) are included.

### 7.3. General Definition of Done for Developed Features/User Stories (Guideline for Development Teams)

Individual features or user stories implemented by the Flutter or Backend developers might be considered "done" when:

* Code is written to agreed-upon standards and best practices.  
* Functionality meets all acceptance criteria defined for the story/feature (based on this project plan and subsequent detailed specifications).  
* Automated tests (unit, integration) are written and passing for new code.  
* The feature is successfully integrated with other parts of the system (e.g., frontend with backend API).  
* Required documentation (e.g., code comments, API documentation updates if any) is complete.  
* The feature has been tested by QA (if applicable) or peer-reviewed.  
* The feature has been demonstrated and approved by the Project Owner or product manager.  
* For UI features: aligns with the approved UI/UX designs and accessibility standards.  
* For backend features: API endpoints perform as specified in the API contract and handle errors gracefully.  
* No known critical bugs related to the feature.

*(Note: The specific DoD for development tasks will be further refined by the development team, potentially on a per-sprint basis if using Agile methodologies.)*

## 8\. Key Project Assumptions

This section lists key assumptions that underpin the planning and execution of this project. If any of these assumptions prove to be false, it may impact the project's scope, timeline, or budget.

1. Resource Availability & Skillset:  
   * It is assumed that appropriately skilled UI/UX, Flutter, and Backend developers can be contracted within the projected budget and timeframe.  
2. Technology & Platforms:  
   * It is assumed that the chosen core technologies (Flutter, Supabase/Firebase, and selected payment gateways) will perform reliably and scale sufficiently for the app's initial user base.  
3. Scope & Requirements Clarity:  
   * It is assumed that this project plan document provides a clear and comprehensive enough definition of scope and requirements for the development and design teams to begin work and provide accurate estimations.  
4. User Adoption & Engagement:  
   * It is assumed that the target audience of real estate agents will perceive significant value in the gamified KPI tracking system, leading to consistent engagement and adoption.  
5. Content & Data:  
   * It is assumed that all initial seed data, such as the predefined KPI list and challenge templates, are accurate and suitable for launch, and that necessary marketing copy will be provided by the Project Owner as needed (as clarified in Section 2.2).  
6. External Factors:  
   * It is assumed that there will be no major disruptive changes to app store policies or relevant regulations that would fundamentally alter the app's feasibility or distribution during the development period.

*(The Project Owner may add further assumptions as the project progresses or upon further review.)*

# User Flow Diagrams \-

# User Flow Diagrams \- KPI Tracker App

This document outlines key user flows for the KPI Tracker App.

# Flow 1: New User Onboarding (Further Refined for Engagement & Logic)

**Goal:** A new user is inspired, provides core financial and current pipeline context, interactively selects key KPIs (seeing their potential value and inputting historical/target data), consents to notifications, optionally sets up team affiliation, creates an account to save progress, and lands on their dashboard with an initial projection, a tier-aware Quick Log, and a clear call to action.

**Actors:** New User

**Preconditions:** User has downloaded/accessed the app for the first time.

Steps:

1. App Launch & Inspirational Opener:  
   * User opens the app for the first time.  
   * **Screen:** Opening Screen 1  
   * **Display:** "What if the work you do today, could predict the success you will have tomorrow?"  
   * **Button:** "Predict Success"  
   * **Link (Discreet):** "Already have an account? Log In" to skip past onboarding  
   * **Actions:** User taps "Predict Success".  
2. Introduction to KPIs / Personalize Performance:  
   * **Screen:** Opening Screen 2  
   * Display:  
     * "Measure What Matters."  
     * "Your Key Performance Indicators (KPIs) are the activities that directly impact your success tomorrow."  
   * **Button:** "**Personalize Your Performance**" (Triggers haptic feedback and a subtle positive sound).  
   * **Actions:** User taps "Personalize Your Performance".  
3. Onboarding Interview: Building Your Initial Projection & Setting Up Quick Logs *(Brief intro screen: **"To see how your performance creates a projection, let's start with some basic financial info and your current pipeline.")***  
4. Core Financials (for PC Calculation Context):  
   * **Screen:** Interview \- Page 1 (Financial Inputs).  
   * **Display:** "Let's begin with a couple of details to help us personalize your projections."  
   * Fields:  
     * What is the  Average Price Point of your transactions (we can adjust this later)  
     * What is Your Typical Commission Rate (%)  
   * **Actions:** User inputs values. Taps "Next".  
   * **System (Temporary Client-Side Storage):** Validates input. Stores these values.  
5. Past Performance Input (GCI):  
   * **Screen:** Interview \- Page 2 (Past GCI).  
   * **Display:** "Understanding your past achievements helps create a relevant starting point."  
   * Fields:  
     * Last Year's Total GCI (You can edit this later)  
     * Current Year-to-Date GCI (you can edit this later)  
   * **Actions:** User inputs values. Taps "Next".  
   * **System (Temporary Client-Side Storage):** Stores GCI values.  
6. Current Pipeline Input (Pending Deals):  
   * **Screen:** Interview \- Page 3 (Current Pipeline \- Escrow/Pending Deals).  
   * **Display:** "Great\! Now, what's currently in your active pipeline and moving towards closing?"  
   * Sections/Fields:  
     * **Sellers (Listings):** "Number of Listings in  Escrow/Pending:" \[Number input\]  
     * **Buyers:** "Number of Purchase Transactions in Escrow/Pending:" \[Number input\]  
     * (UI could allow tapping to increment/decrement or direct input for each category).  
   * **Actions:** User inputs numbers for both sellers and buyers. Taps "Next".  
   * **System (Temporary Client-Side Storage):** Stores these counts. These are crucial for near-term PC and the Pipeline Health Score.  
7. Select Your Key KPIs & Set Baselines/Targets:  
   * **Screen:** Interview \- Page 4 (Select Key Activities & Baselines/Targets).  
   * **Display:** "Now, let's identify your core activities. Start with 3-5 recommended prospecting KPIs, then add more if needed. As you select each one, we'll show you its potential impact\!" (Presents recommended KPIs first with access to full KPI catalog).  
   * Interaction Logic:  
     * Default view shows 3-5 recommended KPIs (role/tier aware) to accelerate onboarding choices.  
     * "Browse All KPIs" reveals the full KPI catalog by currency with search/filter support.  
     * Restricted KPIs remain visible but locked for ineligible tiers and route to upgrade flow when tapped.  
     * `Deal Closed` and `Pipeline Anchor` items are excluded from this selectable onboarding KPI list.  
     * User taps to select a KPI from the list.  
     * Upon selection of a KPI:  
       * A "coin flip" animation (or similar positive visual feedback) occurs.  
       * A message appears: "We estimate each \[KPI Name\] adds approximately **$X** to your future commissions." (Where $X is calculated using `Average Property Price Point`, `Typical Commission Rate` from Step 3, and the KPI's `PC_Weight_Percent`).  
       * Users can input activity counts/baselines/targets only; KPI dollar/value fields are read-only and must not be user-editable.  
       * Input fields appear for that selected KPI:  
         * "Average number of \[KPI Name\] per week (last year)?" \[Input field\]  
         * "Target number of \[KPI Name\] per week (upcoming year)?" \[Input field\]  
     * User proceeds with a recommended set of 3-5 KPIs and may add additional KPIs from the full list, subject to tier limits.  
   * **Actions:** User selects their KPIs, views the value proposition, and inputs their historical averages and future targets for each. Taps "Next" when done.  
   * **System (Temporary Client-Side Storage):** Stores the selected KPIs, their system-calculated estimated value per activity (for context), user-provided historical averages, and target values. Selected KPIs also form the initial Quick Log set.  
8. Notification Permission:  
   * **Screen:** Interview \- Page 5 (Notifications).  
   * **Display:** "Stay on track and motivated\! Allow notifications for important updates, challenge alerts, and performance insights?"  
   * **Buttons:** "Allow Notifications," "Maybe Later."  
   * **Actions:** User taps a button. If "Allow Notifications," system prompts for OS-level permission. Taps "Next."  
   * **System (Temporary Client-Side Storage):** Stores notification preference.  
9. Team Assignment (Optional):  
   * **Screen:** Interview \- Page 6 (Team Setup).  
   * **Display:** "Are you part of a team, or flying solo for now?"  
   * **Options:** "Join an Existing Team," "Create a New Team," "Continue Solo for Now."  
   * **Actions:** User selects an option. If joining, enters code. Taps "Next."  
   * **System (Temporary Client-Side Storage):** Stores team preference/status.  
10. ***(Brief processing/explanation screen: "Fantastic\! You've provided all the initial info. Let's create your secure account to save this and unlock your personalized dashboard.")***  
11. Account Creation (Saving Progress):  
    * **Screen:** Account Creation.  
    * **Fields:** Name, Email, Password, Confirm Password. (Single Sign On)  
    * **Actions:** User fills fields. Taps "Create Account & View Dashboard".  
    * **System:** Validates input. Creates user account in the backend. Associates all temporarily stored interview data (from Steps 3-8) with this new account. Logs the user in. Triggers backend processing of historical averages (developer ensures excluding most recent week) and current pipeline to build initial PC projection and calculate initial Forecast Confidence Score.  
12. Onboarding Complete & Dashboard Landing:  
    * **Screen:** Individual Dashboard.  
    * Display:  
      * Shows PC, GP, VP meters. The PC projection line graph is populated. The "Actual GCI" line shows past GCI.  
      * The "Tap-to-Log" area is populated with the KPIs selected by the user in Step 6\.  
        * **UI Logic for Tap-to-Log:** If the user's current plan (e.g., Free tier) restricts active logging for some of the KPIs they selected in Step 6, those specific KPIs will appear on the Tap-to-Log screen but will be visually indicated as unavailable (e.g., greyed out, with an "upgrade to use" icon/prompt). The KPIs available under their current plan will be fully active.  
      * **Call to Action/Prompt:** "Welcome, \[User's Name\]\! Your initial projection and Quick Log KPIs are set up. To make your projection even more accurate, log your KPIs from this past week\!"  
    * **System:** User fully registered, logged in. Onboarding complete.

# 

## **Flow 2: Logging a KPI**

Goal: An existing user successfully logs an instance (or multiple instances) of a KPI, potentially for the current day or a past date, and can correct errors.

Actors: Existing User (Logged In)

Preconditions:

* User is logged in.  
* User is on a screen with a KPI logging interface (e.g., Individual Dashboard, dedicated Tap-to-Log screen).  
* Date Context:  
  * By default, logs apply to the current day.  
  * The UI must provide a clear way for the user to select a past date if they wish to backdate entries.  
  * Users can log multiple KPIs for a single selected date (current or past) in one session, effectively allowing for "bulk entry for a day" or "logging a week's worth of KPIs for specific past days."

Steps:

1. Access Logging Interface & Set Date (If Backdating):  
   * From Dashboard: User sees quick-log KPI buttons/icons or a "Log Activity" CTA.  
   * From Navigation: User navigates to a dedicated "Tap-to-Log Screen" (if applicable).  
   * Screen: Individual Dashboard or Tap-to-Log Screen.  
   * Action (If Backdating): User interacts with a date picker/calendar element to select a past date for logging.  
   * Display: Selected date is clearly shown.  
2. Select KPI Category/Currency (If Applicable):  
   * Action (If using swipeable Tap-to-Log): User swipes to the desired currency tab (PC, GP, VP, Custom).  
   * Display: Shows KPIs relevant to the selected currency for the chosen date.  
     * KPIs that are part of any of the user's active challenges will display a small visual label/icon representing each challenge they belong to. (Multiple labels possible if a KPI is in multiple active challenges).  
     * To maintain a clean initial view, each currency tab will aim to display a set number of KPIs (e.g., up to 6-8) without scrolling. If the number of active KPIs within the selected currency tab exceeds this, the content area for that tab becomes vertically scrollable.  
3. Identify and Select Specific KPI for Logging:  
   * Display: KPIs are presented with their names, icons, and any associated active challenge labels/icons. User may need to scroll within the currency tab if many KPIs are active.  
   * Action (Single Log): User locates the specific KPI and taps its button/icon once.  
   * Action (Rapid Multi-Log): User presses and holds the KPI button/icon.  
     * UI Feedback (Press & Hold): Animation starts (e.g., button pulses, a counter appears). As long as the user holds, the system rapidly logs multiple instances (e.g., 5-6 in quick succession, or a configurable number). Each instance triggers a "crazy flurry" of haptic feedback and overlapping sound effects. The visual display (e.g., points floating up, meter animation) accelerates.  
   * Display: KPI is highlighted. For press-and-hold, a rapid succession of logging feedback occurs.  
4. Log Interaction & System Processing (for each instance logged):  
   * System (Primary Action per instance):  
     * Records the KPI log event with the selected date and timestamp.  
     * If PC KPI: Backend calculates PC\_Generated\_Event based on user's profile (Avg Price Point, Commission Rate) and KPI's weight. Sets TTC and Decay dates.  
     * If GP/VP KPI: Adds points to user's GP/VP total.  
     * Updates user's last\_activity\_timestamp (even if backdating, the action of logging is current).  
     * Updates progress for any active challenges that include this KPI.  
   * UI Feedback (Frontend per instance):  
     * Visual feedback (e.g., points float up, button animates, meter visibly updates for GP/VP; PC meter updates based on backend calculation).  
     * Sound effect (e.g., "cha-ching" for PC, click for GP).  
     * Haptic feedback.  
   * Screen: Remains on logging screen or dashboard, showing updated state. A summary of logs for the selected date might become visible or update.  
5. (Optional) Secondary Interaction / Value Input (per instance):  
   * Condition: If the logged KPI requires a secondary input (e.g., "Actual GCI" for "Deal Closed" KPI).  
   * Action: A modal/input field appears prompting for the additional value. User inputs value and confirms.  
   * System: Records the additional value with the specific KPI log instance.  
   * UI Feedback: Modal closes, main UI updates.  
   * *Note: For rapid press-and-hold logging, this step would typically apply after the rapid logging sequence for KPIs that require it, or such KPIs might not be suitable for rapid logging.*  
6. Removing a Logged KPI Instance:  
   * Access: User needs a way to view logs for the selected date (e.g., a mini-list, an activity feed for the day).  
   * Action: User identifies a specific logged KPI instance they wish to remove from the day's logs. They tap a subtle "minus" icon or "undo" button associated with that log entry.  
   * Confirmation (Recommended): A quick confirmation prompt appears (e.g., "Remove this log? \[Undo\] \[Cancel\]").  
   * System:  
     * If confirmed, the specified KPI log instance is marked as deleted or its effects are reversed.  
     * If PC KPI: The previously calculated PC contribution is reversed/adjusted.  
     * If GP/VP KPI: Points are subtracted.  
     * Adjusts progress for any relevant active challenges.  
   * UI Feedback: The log entry is removed from the daily summary. Meters update to reflect the removal.  
7. Logging More KPIs for the Selected Date:  
   * Action: User repeats steps 2-6 to log other KPIs for the currently selected date.

## **Flow 3: Viewing and Interpreting the Individual Dashboard**

Goal: User accesses their individual dashboard to understand their current PC, GP, VP status, view their PC projection (with a focus on the next 90 days), check forecast confidence, and see actuals.

Actors: Existing User (Logged In)

Preconditions: User is logged in. Data has been logged previously, or it's the initial empty state.

Steps:

1. Navigate to Dashboard:  
   * Action: User logs in (lands on dashboard by default) OR navigates to the "Dashboard" section from another part of the app (e.g., via a bottom navigation bar).  
   * Screen: Individual Dashboard.  
2. View Key Metric Summaries (Meters):  
   * Display: Prominently shows current values for:  
     * Projected Commissions (PC) Meter: Displays the total PC projected for the next 90 days. (The system calculates this by summing all active PC contributions expected to mature or be active within the next 90 days).  
     * Growth Points (GP) Meter: Displays total GP.  
     * Vitality Points (VP) Meter: Displays total VP.  
     * These meters might have associated animations or visual state representations (e.g., tiered states for GP/VP based on accumulation or decay).  
   * Action: User visually scans these key metrics.  
3. View Actual GCI and Deals Closed:  
   * Display: Clearly shows:  
     * Actual GCI (YTD or selected period): Total Gross Commission Income logged.  
     * Deals Closed (YTD or selected period): Total number of deals closed.  
   * Action: User reviews their actual performance.  
4. Interpret PC Projection Line Graph:  
   * Display: A line graph showing the user's Projected Commission over future time (e.g., next 12 months).  
     * The Y-axis shows PC amount.  
     * The X-axis shows future months/dates.  
     * The line itself represents the calculated PC projection based on logged KPIs, their TTCs, and decay.  
     * Highlight/Default View: While the graph shows the longer term, the UI might emphasize or default to showing a clear marker or summary for the PC value at the 90-day point to align with the main PC meter.  
   * Action: User views the trend of their future PC potential, with an understanding of the 90-day outlook.  
5. Interpret Forecast Confidence Score/Meter:  
   * Display:  
     * Visual Indicator: The PC projection line graph (or sections of it) might be color-coded (Green/Yellow/Red) based on the Forecast Confidence Score for that period. The confidence for the initial 45-90 day period would be particularly relevant. Alternatively, a separate "Forecast Confidence Meter" (gauge, percentage display) shows the overall confidence, perhaps with a focus on the near-to-mid term.  
     * Percentage (Optional): The overall confidence score (0-100%) might be displayed.  
   * Action: User assesses the reliability of their PC projection.  
   *  Drill-down: User might tap on the confidence meter/indicator.  
     * Display (If tapped): Shows a breakdown or reasons for the current confidence level (e.g., "Historical Accuracy: Good", "Pipeline Health (next 45 days): Low", "Recent Activity: High").  
6. View Coaching Messages (Contextual):  
   * Display: If any coaching messages related to forecast confidence, KPI performance, or suggestions are triggered by the backend, they are displayed in a designated area on the dashboard (e.g., a "Tips" section, a dismissible banner, or an inbox).  
   * Action: User reads the coaching messages. Messages might be interactive (e.g., "Click here to review your pipeline.").  
7. Access Quick KPI Logging (If Integrated):  
   * Display: Dashboard may include quick-access buttons/icons for frequently logged KPIs.  
   * Action: User can tap these to initiate "Flow 2: Logging a KPI."  
8. View Pipeline Status:  
   * Display: A section showing the current counts for "Pipeline: Listings Pending" and "Buyers Under Contract."  
   * Action: User reviews the status of their mid-to-late stage pipeline.

## **Flow 4: Managing KPI Selection in Settings**

Goal: User customizes the list of KPIs available on their primary logging interface (e.g., "Tap-to-Log" screen or dashboard quick-log area), with changes saved automatically.

Actors: Existing User (Logged In)

Preconditions: User is logged in.

Steps:

1. Navigate to Settings:  
   * Action: User taps on "Settings" or "Profile" icon/menu item (e.g., from a bottom navigation bar, side menu).  
   * Screen: Settings/Profile main screen.  
2. Select "Manage KPIs" / "Customize Log Screen":  
   * Action: User finds and taps an option like "Manage My KPIs," "Customize Logging," or "Edit Quick-Log KPIs."  
   * Screen: KPI Selection/Management Screen.  
3. View Current vs. Available KPIs:  
   * Display: The screen typically shows two main sections or views:  
     * "My Loggable KPIs" / "Currently Shown": A list or grid of KPIs currently selected by the user for their quick-log interface. These KPIs are displayed sorted by currency (PC, GP, VP, Custom) and are color-coded/styled according to their currency theme. KPIs that are part of any of the user's active challenges will display a small visual label/icon representing each challenge they belong to. They are reorderable within their currency group or across all, depending on design.  
     * "Available KPIs" / "Add More KPIs": A categorized list of all KPIs available in the system, also sorted by currency and styled/color-coded accordingly. Each KPI might show its name, icon, and perhaps a brief description or type. It may also show read-only value/payoff timeline metadata (for example, "$20 in 90 days"), sourced from current admin-defined KPI configuration; this metadata is not editable by end users. If a KPI in this list is part of an active challenge for the user (even if not currently on their loggable list), it may also show the challenge label(s) as an indicator.  
   * Team Context:  
     * If the user is part of a team, KPIs mandated by the team leader that are in "My Loggable KPIs" will be visually indicated as "Required" or locked (cannot be removed or reordered in a way that conflicts with team settings).  
4. Add a KPI to Logging Screen:  
   * Action: User browses or searches the "Available KPIs" list. User finds a KPI they want to add and taps an "Add" button, a "+" icon, or a checkbox next to it.  
   * UI Feedback: The selected KPI visually moves or appears in the "My Loggable KPIs" section, in its appropriate currency group, retaining any challenge label indicators. A confirmation message might briefly appear (e.g., "KPI Added").  
   * System: Change is saved automatically. Updates the user's preference for displayed KPIs in the backend.  
   * Constraints:  
     * Free users might have a limit on the number of KPIs they can have on their active logging screen. If the limit is reached, the "Add" option might be disabled, or they are prompted to upgrade or remove an existing KPI.  
5. Remove a KPI from Logging Screen:  
   * Action: User looks at their "My Loggable KPIs" list. User finds a KPI they want to remove and taps a "Remove" button, "x" icon, or unchecks it.  
   * UI Feedback: The KPI is removed from the "My Loggable KPIs" section and visually returns to the "Available KPIs" list (or simply disappears from the active list). A confirmation (e.g., "KPI Removed," possibly with an "Undo" option for a few seconds) might appear.  
   * System: Change is saved automatically. Updates the user's preference in the backend.  
   * Constraints:  
     * Team-mandated KPIs cannot be removed (the "Remove" option would be disabled or absent for these).  
6. Reorder Loggable KPIs:  
   * Action: User presses and holds on a KPI in their "My Loggable KPIs" list and drags it to a new position to change the display order on their logging screen (either within its currency group or across all, TBD by design).  
   * UI Feedback: KPIs reorder visually.  
   * System: New order is saved automatically in the backend.  
7. Exit KPI Management:  
   * Action: User taps a "Back" button or navigates to another section of the app (e.g., Dashboard).  
   * System: No explicit save action is needed as changes were saved as they were made.  
   * Screen: User returns to the previous screen or the newly navigated section. The Dashboard/Tap-to-Log screen will reflect the updated KPI selection and order.

## **Flow 5: Viewing Challenge List / Selecting & Joining a Challenge**

Goal: User browses available challenges based on their subscription plan and successfully joins an eligible challenge.

Actors: Existing User (Logged In)

Preconditions: User is logged in. User's subscription tier (Free, Paid Solo, Paid Team) is known.

Steps:

1. Navigate to Challenges Section:  
   * Action: User taps on a "Challenges" tab or menu item (e.g., from a bottom navigation bar, dashboard CTA).  
   * Screen: Challenge Hub / Challenge Selection Screen.  
2. View Available Challenges (Based on Plan):  
   * Display Logic: The system filters and displays challenges based on the user's plan:  
     * Free Plan User:  
       * Typically shows a message like "Upgrade to access challenges" or "No challenges currently available."  
       * Promotional Challenges: If a promotional challenge is active and available to free users, it will be displayed (with its predefined label/icon).  
     * Paid Solo User:  
       * Shows the list of Preset Challenge Templates (the 10 defined), each with its predefined label/icon.  
       * May indicate if they already have 1 active challenge.  
     * Paid Team User:  
       * Shows Preset Challenge Templates (with predefined labels/icons).  
       * Shows Team Challenges created by their team leader or available to the team (these will have their chosen/defined labels/icons).  
       * Shows an option to Create Custom Challenges (if they are a Team Leader or have permissions).  
     * Sponsored Challenges (Future Feature): If available, these would be displayed to eligible tiers (with their brand labels/icons).  
   * General Display per Challenge: Name, challenge label/icon, brief description, goal, duration.  
   * Filtering/Sorting (Optional): Options to filter by type (Solo, Team, Custom, Sponsored \- as applicable to their plan) or sort.  
   * Action: User scrolls/browses the list of challenges available to them.  
3. Select a Challenge to View Details:  
   * Action: User taps on a specific challenge from the list.  
   * Screen: Challenge Detail/Preview Screen.  
   * Display: Shows more detailed information about the selected challenge:  
     * Full Name & Description  
     * Challenge Label/Icon (chosen by creator for custom, predefined for templates)  
     * Specific Goal(s) and KPIs involved  
     * Duration  
     * Rewards (if any)  
     * Mode (Solo or Team \- if applicable to the template/custom challenge)  
     * For Team Challenges: List of participating teammates or option to invite.  
   * Actions: "Join Challenge" (or "Start Challenge") button, "Back" button.  
4. Initiate Joining Challenge:  
   * Action: User taps the "Join Challenge" (or "Start Challenge") button.  
   * Constraints (Checked by System):  
     * Free Plan User: Can only join if it's an active promotional challenge they are eligible for. Otherwise, prompted to upgrade.  
     * Paid Solo User:  
       * Can only have 1 active predefined challenge at a time.  
       * If limit is reached: Message "You can only have 1 active challenge. Complete or leave your current challenge to join a new one."  
     * Paid Team User:  
       * Can join/create unlimited predefined and custom challenges (within reasonable system limits).  
       * Custom challenge creation is a feature of the Teams package.  
     * General Limit: User might be limited to 1-2 total active challenges (across all types) at a time, as per original plan (this needs to be reconciled with "unlimited" for teams – perhaps unlimited *available* but a limit on *concurrently active*). *For now, assuming paid solo \= 1 active, paid team \= potentially more concurrent.*  
     * Some challenges might have tier restrictions not covered above.  
   * UI Feedback: If constraints are met, proceed. If not, display an informative message.  
5. Confirm Challenge Mode (If Applicable for Template/Custom):  
   * Condition: If a preset challenge template can be played in "Solo" or "Team" mode, OR if a Team User is creating a custom challenge and needs to define its mode.  
   * Screen: Modal or selection step.  
   * Display: Prompts user to choose: "Play Solo" or "Play with Team."  
   * Action: User selects mode.  
     * If "Play with Team," and user is a leader starting a new team instance: may be prompted to select teammates.  
     * If "Play with Team," and user is joining an existing team instance: they join that instance.  
6. Challenge Joined/Started Successfully:  
   * System:  
     * Records the user's participation in the challenge (associating the specific challenge label/icon with this active instance).  
     * Sets up tracking for the relevant KPIs for this challenge.  
     * If it's a new instance of a team challenge started by a leader, enrolls selected members.  
   * UI Feedback:  
     * Confirmation message (e.g., "Challenge Started\! Good luck\!").  
     * User is navigated to the "Active Challenge View" for this newly joined/started challenge (see Flow 6).  
     * The joined/started challenge now appears in an "Active Challenges" section on the Challenge Hub or Dashboard.

## **Flow 6: Viewing and Interacting with an Active Challenge**

Goal: User views their progress in an active challenge, understands the requirements (individual or team-based goals), receives relevant notifications, and (if applicable) sees team progress and contribution percentages, and manages participants according to permissions.

Actors: Existing User (Logged In, participating in at least one active challenge)

Preconditions:

* User is logged in.  
* User has at least one active challenge.  
* The challenge definition includes whether KPI goals are individual or team-based.

Steps:

1. Navigate to Active Challenge View:  
   * Action (Option A \- From Challenge Hub/List): After joining a challenge (end of Flow 5), user is often taken here directly. Or, user navigates to the "Challenges" section and selects an "Active Challenge" from a list/tab.  
   * Action (Option B \- From Dashboard): User might tap on an "Active Challenge" widget or summary on their main dashboard.  
   * Screen: Active Challenge View screen for the specific challenge.  
2. View Challenge Overview & Progress:  
   * Display:  
     * Challenge Name & Label/Icon: Clearly displayed.  
     * Challenge Goal/Description: Reminds the user of the objective.  
     * Time Remaining: Countdown timer or display of days/hours left.  
     * Overall Progress:  
       * A prominent progress bar or percentage complete for the entire challenge.  
       * If team goal: This reflects the team's collective progress towards the team target(s).  
       * If individual goals within a team challenge, or a solo challenge: This might reflect the user's average completion across all their individual KPI targets in the challenge.  
     * Personal Contribution (If Team Challenge with Team Goals):  
       * Shows what the individual user has logged for KPIs contributing to team goals.  
       * For Team Leaders (and potentially members): May display the user's contribution percentage towards the team's total logged activities for relevant KPIs, even if the main goal is met.  
3. View Challenge-Specific KPIs & Individual Progress:  
   * Display: A list of the specific KPIs that are part of this challenge. For each challenge KPI:  
     * KPI Name & Icon.  
     * Goal Type: Clearly indicates if the target for this KPI is "Individual Goal" or "Team Goal."  
     * User's current logged count/value for this KPI *within the challenge's context/duration*.  
     * Target count/value:  
       * If "Individual Goal": The specific target for the user for this KPI (e.g., "Log 10 Sphere Calls").  
       * If "Team Goal": The overall target for the team for this KPI (e.g., "Team logs 100 Sphere Calls").  
     * Progress Display:  
       * If Individual Goal: A mini progress bar or visual indicator for the user's completion of *their individual target* for this KPI. User cannot score more than the max points/credit for achieving this individual target.  
       * If Team Goal: Shows the user's logged count contributing to the team's progress bar for this KPI. The team's overall progress towards the team target is shown.  
   * Action: User reviews their performance and/or contribution.  
4. View Rewards (If Applicable):  
   * Display: If the challenge offers rewards (e.g., badges, points, sponsored prizes), this section details them.  
5. View Team Leaderboard (If Team Challenge):  
   * Display: A snippet or full leaderboard showing:  
     * Rank of team members.  
     * Name of team members.  
     * Score/Contribution:  
       * If based on individual goals within the team challenge: Shows individual scores/completion.  
       * If based on team goals: Shows individual contribution counts and/or contribution percentages. These percentages and ranks can continue to change even after a team goal is met, reflecting ongoing activity.  
     * Highlight for the current user's position.  
     * Animations for rank changes (as per original plan).  
   * Action (Optional): User might tap to view a more detailed team leaderboard screen if only a snippet is shown.  
6. Invite Participants to Challenge (Context-Dependent):  
   * A. For Team Challenges:  
     * Display: An "Invite Teammates" button or option is visible only to the Team Leader of the team associated with the challenge.  
     * Action (Team Leader): Team Leader taps to invite.  
       * Screen: Opens a list of their team members not yet in this specific challenge instance.  
       * Team Leader selects teammates to invite.  
     * System (Team Leader Invite):  
       * Sends invites to selected team members.  
       * If a team member is added/accepts after the challenge start date: The Team Leader (as the challenge maker) is prompted: "Include \[New Member's Name\]'s KPI entries logged between \[Challenge Start Date\] and today for this challenge? \[Yes, Include\] \[No, Start Fresh\]". This decision is recorded.  
   * B. For Individual/Solo Challenges (Shared Participation \- NEW CONCEPT):  
     * Display: An "Invite Friend to Join" button or option may be visible to the individual user who started/joined the solo challenge.  
     * Action (Individual User): User taps to invite.  
       * Screen: Prompts for another user's email/username or provides a shareable invite link for this specific instance of the solo challenge.  
     * System (Individual Invite):  
       * Sends invite or processes join via link.  
       * If an invited user is added after the challenge start date: The original user who initiated this shared challenge instance (the challenge maker for this instance) is prompted: "Include \[New Friend's Name\]'s KPI entries logged between \[Challenge Start Date\] and today for this challenge? \[Yes, Include\] \[No, Start Fresh\]".  
     * *Note: This "shared individual challenge" concept needs further definition regarding leaderboards (if any between invitees) and how it differs from a formal team challenge.*  
7.  Leave Challenge:  
   * Display: An option to "Leave Challenge" (might be in a menu or less prominent).  
   * Action: User taps "Leave Challenge."  
   * Confirmation: "Are you sure you want to leave this challenge? Your progress will be lost." \[Leave\] \[Cancel\].  
   * System: If confirmed, removes user from the challenge. Progress is no longer tracked for them for this challenge.  
   * UI Feedback: User is returned to the Challenge Hub/List.  
8. Navigate to Log KPIs:  
   * Display: Clear CTAs or links to "Log KPIs" or directly to the Tap-to-Log screen.  
   * Action: User taps to go log activities, some of which will contribute to this active challenge.  
   * Contextual Logging (Ideal): If navigating from an active challenge view, the Tap-to-Log screen could potentially highlight or prioritize the KPIs relevant to that challenge.  
9. Key System-Generated Notifications During/After Active Challenge:  
   * Purpose: To keep users engaged, informed, and motivated regarding their challenges. These are typically push notifications and/or in-app messages.  
   * Types of Notifications:  
     * Challenge Starting Soon: (As defined in Flow 7, Step 7, if a future start date was set)  
       * *Trigger:* Approaching the scheduled start date of a challenge the user is enrolled in (e.g., "Starts in 3 days," "Starts tomorrow," "Starts today\!").  
       * *Content Example:* "\[Challenge Name\] is about to begin\! Get ready to crush your goals."  
     * Significant Milestone Achieved:  
       * *Trigger:* User (or their team) reaches a notable percentage of the challenge goal (e.g., 25%, 50%, 75% complete) or completes a key sub-goal.  
       * *Content Example:* "Awesome\! You're 50% of the way through the \[Challenge Name\]\!" or "Your team just hit a major milestone in \[Challenge Name\]\!"  
     * Challenge Ending Soon:  
       * *Trigger:* Challenge is approaching its end date (e.g., 48 hours left, 24 hours left, ends today).  
       * *Content Example:* "Time is running out\! Only 24 hours left in the \[Challenge Name\]. Give it one last push\!"  
     * Challenge Completed / Results Available:  
       * *Trigger:* Challenge duration ends.  
       * *Content Example (Individual):* "Congratulations\! You've completed the \[Challenge Name\]. Check out your results\!" (Links to challenge summary/results screen).  
       * *Content Example (Team):* "The \[Challenge Name\] has ended\! See how your team performed and view the final leaderboard." (Links to challenge summary/results screen).  
     * Leaderboard Rank Change (Team Challenges \- Optional):  
       * *Trigger:* Significant change in the user's rank or their team's rank on a challenge leaderboard.  
       * *Content Example:* "You've moved up to 2nd place in the \[Challenge Name\] leaderboard\!"  
   * User Action on Notification: Tapping the notification typically takes the user to the relevant "Active Challenge View" screen or a "Challenge Results" screen.

## **Flow 7: Team Leader Creating a Custom Challenge**

Goal: A Team Leader successfully creates, defines, and launches a new custom challenge for their team members, potentially with a future start date.

Actors: Team Leader (User with appropriate permissions and on a "Teams Package" plan)

Preconditions:

* User is logged in as a Team Leader.  
* Their team has access to the custom challenge creation feature (Teams Package).

Steps:

1. Navigate to Challenge Creation:  
   * Action: From the Challenge Hub (where they view available challenges \- see Flow 5, Step 2), the Team Leader taps a "Create Custom Challenge" or "+" button.  
   * Screen: Custom Challenge Creation Form \- Step 1 (Basic Info).  
2. Define Basic Challenge Information:  
   * Screen: Custom Challenge Creation Form \- Step 1\.  
   * Fields:  
     * Challenge Name: (e.g., "Q3 Listing Push," "August Appointment Blitz").  
     * Challenge Description: (Brief overview of the challenge's purpose).  
     * Challenge Label/Icon: Team Leader selects a visual label or icon for this challenge (this will be displayed on KPIs associated with this challenge).  
     * Start Date (Optional): Defaults to "Today/Now". Team Leader can select a future start date.  
     * Challenge Duration: (e.g., 7 days, 30 days). User selects from presets or sets a custom duration (end date calculated from start date \+ duration).  
   * Action: Team Leader fills in the details. Taps "Next."  
3. Select KPIs for the Challenge:  
   * Screen: Custom Challenge Creation Form \- Step 2 (KPI Selection).  
   * Display: Shows a list of all available KPIs (PC, GP, VP, potentially team-shared Custom KPIs), likely categorized.  
   * Action: Team Leader selects 3-6 KPIs that will be part of this challenge.  
   * Constraints: Must select between 3 and 6 KPIs.  
   * UI Feedback: Selected KPIs are highlighted or added to a "Selected for Challenge" list.  
   * Action: Team Leader taps "Next."  
4. Define KPI Targets and Goal Types (for selected KPIs):  
   * Screen: Custom Challenge Creation Form \- Step 3 (Set KPI Goals).  
   * Display: For each KPI selected in the previous step, the Team Leader defines:  
     * Target Value: (e.g., "10 Listings Taken," "50 Sphere Calls").  
     * Goal Type:  
       * "Individual Goal": Each participant must achieve this target individually.  
       * "Team Goal": The entire team collectively works towards this target.  
   * Action: Team Leader inputs target values and selects goal type for each chosen KPI. Taps "Next."  
5. Select Participants (Team Members):  
   * Screen: Custom Challenge Creation Form \- Step 4 (Add Participants).  
   * Display: Shows a list of all members in the Team Leader's team.  
   * Action: Team Leader selects participants:  
     * Option to "Select All" team members.  
     * Option to individually select/deselect team members.  
   * UI Feedback: Selected members are highlighted.  
   * Action: Team Leader taps "Next" or "Review."  
6. Review and Launch Challenge:  
   * Screen: Custom Challenge Creation Form \- Step 5 (Review & Launch).  
   * Display: A summary of all configured challenge details:  
     * Name, Description, Label/Icon, Start Date, Duration, End Date.  
     * Selected KPIs with their targets and goal types (Individual/Team).  
     * List of selected participants.  
   * Actions: "Launch Challenge" button, "Edit" buttons for each section, "Back" button.  
   * Action (If edits needed): Team Leader taps "Edit" for a section, is taken back to the relevant step (e.g., Step 3 to change KPIs), makes changes, and returns to Review.  
   * Action (To Launch): Team Leader taps "Launch Challenge."  
7. Challenge Launched Successfully:  
   * System:  
     * Creates the new custom challenge instance with its defined start and end dates.  
     * Enrolls all selected participants.  
     * If Start Date is in the Future: Schedules pre-challenge notifications (e.g., "Challenge \[Challenge Name\] starts in 3 days\!", "Challenge \[Challenge Name\] starts tomorrow\!").  
     * If Start Date is Today/Past (for immediate launch):  
       * Sends notifications to enrolled participants about the new challenge starting now.  
       * For any participant added (including initial launch): The system considers if prior KPI entries (from challenge start date up to join date) should be included, based on the Team Leader's decision during the late-add process (as defined in Flow 6, Step 6.A) or a default setting for initial launch (e.g., start fresh unless specified for late adds).  
     * If Start Date is in the Future (and participants are enrolled): When the actual start date arrives, a "Challenge Started\!" notification is sent.  
   * UI Feedback:  
     * Confirmation message (e.g., "Your custom challenge '\[Challenge Name\]' has been scheduled/launched\!").  
     * Team Leader might be navigated to a view of scheduled/active challenges, or back to the Challenge Hub.

## **Flow 8: Team Leader Managing Their Team**

Goal: A Team Leader successfully manages their team members, including invitations, removals, and potentially setting team-wide KPI rules.

Actors: Team Leader (User with appropriate permissions)

Preconditions:

* User is logged in as a Team Leader.  
* The user has an active team associated with their account.

Steps:

1. Navigate to Team Management Area:  
   * Action (Option A \- From Team Dashboard): User navigates to their "Team Dashboard" (which might also show aggregated team stats, as per original plan Section 2.3). From there, they access a "Manage Team" or "Team Settings" option.  
   * Action (Option B \- From General Settings): User navigates to "Settings" \-\> "My Team" or "Team Management."  
   * Screen: Team Management Hub / Team Roster Screen.  
2. View Team Roster:  
   * Display: Shows a list of all current members in the team. For each member:  
     * Name / Avatar  
     * Email (possibly)  
     * Role (Member \- leader is implied as current user)  
     * (Optional) Last activity date or basic engagement stat snippet.  
   * Actions available per member (e.g., via a context menu or row action): "Remove from Team," "View Profile" (limited view).  
3. Invite New Members to the Team:  
   * Action: Team Leader taps an "Invite New Member" or "+" button.  
   * Screen: Invite Member Interface.  
   * Options for Inviting:  
     * Enter Email Address: Leader enters one or more email addresses.  
     * Generate Invite Code/Link: System generates a unique code or shareable link that new users can use during onboarding (Flow 1, Step 5\) or existing solo users can use to join.  
   * Action: Team Leader uses one of the methods to send out invitations or share the code/link.  
   * System:  
     * If email invite: Sends an email invitation with a link to join the team.  
     * If code/link: Makes the code/link active for a certain period or number of uses.  
     * Tracks pending invitations.  
4. Manage Pending Invitations / Join Requests:  
   * Display: A section showing outstanding invitations sent by the leader, or incoming join requests if the team is set to require approval for code/link joins.  
   * Actions (For Sent Invites): Resend Invite, Revoke Invite.  
   * Actions (For Join Requests): Approve Request, Deny Request.  
   * System: Processes approvals/denials, updates team roster, sends notifications.  
5. Remove a Member from the Team:  
   * Action: From the team roster (Step 2), Team Leader selects a member and taps a "Remove from Team" option.  
   * Confirmation: "Are you sure you want to remove \[Member's Name\] from the team? Their access to team challenges and data will be revoked." \[Remove\] \[Cancel\].  
   * System: If confirmed:  
     * Removes the member from the team roster.  
     * Revokes their access to team-specific data, challenges, etc.  
     * The removed user's account reverts to a solo account (their individual data remains, but team association is severed).  
     * Notification sent to the removed user.  
   * UI Feedback: Member is removed from the list.  
6.  Set/Manage Team-Wide Mandatory KPIs:  
   * Condition: If the system allows Team Leaders to define specific KPIs that are mandatory for all team members to have on their logging screens (as per original plan Section 2.5: "Option to assign mandatory KPIs per user, which cannot be removed from their logging screen").  
   * Action: Team Leader navigates to a "Team KPI Settings" or similar subsection within Team Management.  
   * Screen: Team Mandatory KPI Selection Screen.  
   * Display: Lists all available system KPIs.  
   * Action: Team Leader selects/deselects KPIs to be designated as "mandatory" for their team.  
   * System: Saves these settings. When team members access their "Manage KPI Selection" screen (Flow 4), these KPIs will be locked and indicated as team-required.  
   * UI Feedback: Confirmation that team KPI settings are updated. Notifications might be sent to team members about changes to mandatory KPIs.  
7. Exit Team Management:  
   * Action: User taps a "Back" button or navigates to another section of the app.  
   * System: Changes (like member removals, new invites sent, mandatory KPIs set) are persisted.  
   * Screen: User returns to the previous screen (e.g., Team Dashboard, Settings).

## **Flow 9: Viewing the Team Dashboard**

Goal: A team member or Team Leader views aggregated team performance and individual member summaries, with options to drill down or manage the team (for leaders).

Actors: Existing User (Logged In, member of a team), Team Leader

Preconditions:

* User is logged in and is part of an active team.

Steps:

1. Navigate to Team Dashboard:  
   * Action: User taps on a "Team," "Team Dashboard," or similar tab/menu item (e.g., from a bottom navigation bar).  
   * Screen: Team Dashboard.  
2. View Primary Aggregated Team Stats (Center Stage):  
   * Display: The most prominent section of the dashboard shows:  
     * Aggregated Team Actual GCI: (e.g., YTD or selected period).  
     * Aggregated Team 90-day Projected GCI: The sum of all team members' 90-day PC projections.  
   * Action: User gets an immediate overview of the team's core financial performance indicators.  
3. View Team Member List with Key Individual Stats:  
   * Display: Below or alongside the primary aggregated stats, a list of all team members is displayed. For each member:  
     * Member Name / Avatar.  
     * Individual Actual GCI: (e.g., YTD or selected period).  
     * Individual 90-day Projected GCI.  
     * a compact progress bar or rank indicator for overall activity/PC).  
   * Sorting: The list might be sortable by name, Actual GCI, Projected GCI, or rank.  
   * Action: User scans the list to see individual contributions and standings.  
4. Drill Down to Individual Member Details:  
   * Action: User taps on a specific team member's name or row in the list.  
   * UI Feedback: The selected member's row might expand in place, or the user navigates to a detailed view.  
   * Screen (If Navigation): A view similar to the "Individual Dashboard" (Flow 3\) but for the selected team member.  
   * Display (Drill-Down View):  
     * Shows the selected member's full Individual Dashboard: their PC (90-day), GP, VP meters, their PC projection line graph, their Forecast Confidence Score, their specific Actual GCI & Deals Closed, their active challenges, and their recent activity/logged KPIs (respecting any privacy settings if applicable, though Team Leaders generally have full visibility).  
   * Action: User reviews the detailed performance of the selected team member. User can navigate back to the main Team Dashboard.  
5. View Other Aggregated Team Metrics (Secondary Display):  
   * Display: The Team Dashboard may also include other aggregated team metrics, potentially less prominent than the primary GCI figures:  
     * Aggregated Team GP.  
     * Aggregated Team VP.  
     * Total Team Deals Closed.  
     * Team-level progress bars for these metrics.  
     * Team rank change animations (if applicable to overall team performance or team challenges).  
   * Action: User gets a broader view of team performance across different currencies.  
6. Access Team Management (For Team Leaders Only):  
   * Display: If the logged-in user is a Team Leader, a "Manage Team," "Team Settings," or similar button/icon is visible.  
   * Action: Team Leader taps this button.  
   * System: Navigates to the "Team Management Hub" (as detailed in Flow 8: Team Leader Managing Their Team).  
7. Access Team Challenges:  
   * Display: A section or CTA linking to active team challenges or the main Challenge Hub.  
   * Action: User taps to navigate to view/join/manage team challenges (leading to Flow 5 or Flow 6).

## **Flow 10: User Managing Profile, Settings & Goals**

Goal: User accesses and updates their personal profile information, application settings (like notifications), their GCI/Deals goals, and accesses coaching resources.

Actors: Existing User (Logged In)

Preconditions: User is logged in.

Steps:

1. Navigate to Settings/Profile:  
   * Action: User taps on "Settings," "Profile," or their avatar/icon (e.g., from a bottom navigation bar, side menu, or dashboard).  
   * Screen: Main Settings/Profile Screen.  
2. View Settings/Profile Options:  
   * Display: The screen presents various sections/options, such as:  
     * "Edit Profile" (Name, Email \- password change might be separate)  
     * "My Goals" (GCI Goal, Deals Closed Goal, Average Price Point, Commission Rate)  
     * "Manage My KPIs" (Leads to Flow 4\)  
     * "My Coaching"  
     * "Notification Preferences"  
     * "Subscription Management" ("My Plan" \- Leads to Flow 11\)  
     * "My Team" (If part of a team; for members, it might show team info; for leaders, it leads to Flow 8\)  
     * "Help & Support"  
     * "Privacy Policy," "Terms of Service"  
     * "Log Out"  
   * Action: User selects the desired section to manage.  
3. Edit Profile Information:  
   * Action: User taps "Edit Profile."  
   * Screen: Edit Profile Form.  
   * Fields (Editable): Name. (Email might be view-only or have a separate change process for security. Password change is typically a distinct flow with current password verification).  
   * Action: User modifies their name. Taps "Save" or "Done."  
   * System: Updates user's name in the backend. Changes are saved automatically if no explicit save button.  
   * UI Feedback: Confirmation message. Screen returns to Main Settings/Profile.  
4. Adjust Goals & Financial Inputs:  
   * Action: User taps "My Goals" or "Financial Inputs."  
   * Screen: Edit Goals & Financials Form.  
   * Fields (Editable):  
     * GCI Goal (next 365 days)  
     * Deals Closed Goal (next 365 days)  
     * Average Property Price Point  
     * Your Typical Commission Rate  
   * Action: User modifies desired values. Taps "Save" or "Done."  
   * System: Updates these values in the user's profile in the backend. These changes will affect future PC calculations. Changes are saved automatically.  
   * UI Feedback: Confirmation message. Screen returns to Main Settings/Profile.  
5. Access My Coaching:  
   * Action: User taps "My Coaching."  
   * Screen: "My Coaching" Hub/Screen.  
   * Potential Display/Actions within "My Coaching":  
     * Link to the "Coaching Promotion Screen" (if user is eligible and not yet engaged with a specific coaching offering).  
     * A section to view an archive or list of past coaching messages/tips received (related to forecast confidence, KPI performance, etc.).  
     * Information or CTAs for booking coaching sessions (if this feature is part of their subscription tier or enterprise setup).  
     * Links to relevant help articles, best practices, or educational content focused on improving KPI performance and goal achievement.  
   * Action: User interacts with coaching resources, views messages, or navigates to booking/promotional pages. User can navigate back to Main Settings/Profile.  
6. Manage Notification Preferences:  
   * Action: User taps "Notification Preferences."  
   * Screen: Notification Settings Screen.  
   * Display: Lists various types of notifications with toggles (on/off):  
     * Challenge Notifications (e.g., starts soon, ending soon, completed)  
     * Coaching Messages/Tips (the actual push/in-app alert setting)  
     * Team Activity Summaries (if applicable)  
     * Promotional Announcements (opt-in)  
   * Action: User toggles preferences on/off.  
   * System: Saves notification preferences automatically.  
   * UI Feedback: Toggles update state. Screen returns to Main Settings/Profile when user navigates back.  
7. Access Other Settings Sections:  
   * Action: User selects other options like "Help & Support," "Privacy Policy," etc.  
   * Screen: Navigates to the respective informational screen or external link.  
8. Log Out:  
   * Action: User taps "Log Out."  
   * Confirmation: "Are you sure you want to log out?" \[Log Out\] \[Cancel\].  
   * System: If confirmed, invalidates user's session token.  
   * Screen: User is navigated to the App Launch/Login screen (Flow 1, Step 1).

## **Flow 11: Subscription Management/Upgrade Flow**

Goal: User views their current subscription details, explores other available subscription tiers, and successfully upgrades their plan.

Actors: Existing User (Logged In)

Preconditions: User is logged in.

Steps:

1. Navigate to Subscription Management:  
   * Action (Option A \- From Settings): User navigates to "Settings/Profile" (Flow 10, Step 1\) and taps on "Subscription Management" or "My Plan."  
   * Action (Option B \- From Upgrade Prompt): User might encounter a feature that requires a higher tier (e.g., trying to create a custom challenge on a free/basic solo plan) and taps an "Upgrade Plan" CTA.  
   * Screen: Subscription & Tiers Screen (as per original plan Section 2.3).  
2. View Current Subscription & Available Tiers:  
   * Display:  
     * Current Plan: Clearly shows the user's current subscription tier (e.g., "Free," "Basic Solo," "Teams"). May show renewal date or price if applicable.  
     * Available Tiers: Lists other available subscription tiers (e.g., Basic, Teams, Enterprise). For each tier:  
       * Tier Name  
       * Price (e.g., monthly/annual)  
       * Key feature breakdown/comparison (highlighting what's included or what's better than their current plan or lower tiers).  
       * A "Select Plan," "Upgrade," or "Learn More" CTA.  
   * Action: User reviews their current plan and compares available tiers.  
3. Select a Tier to Upgrade To:  
   * Action: User taps the "Upgrade" or "Select Plan" CTA for a desired higher tier.  
   * Screen: Plan Confirmation / Payment Details Screen.  
4. Confirm Upgrade & Enter/Confirm Payment Details:  
   * Display:  
     * Shows the selected plan, its price, and billing cycle (monthly/annual).  
     * If the platform supports it, might show pro-rated costs if upgrading mid-cycle.  
     * Payment input fields (if not already on file or if using in-app purchases). This would integrate with native iOS/Android payment flows or a web payment gateway (e.g., Stripe).  
   * Action:  
     * User confirms the plan selection.  
     * User enters new payment details or confirms existing ones.  
     * User agrees to terms and taps a "Confirm Purchase," "Subscribe," or "Pay" button.  
   * System: Initiates payment processing via the relevant payment gateway (Apple IAP, Google Play Billing, Stripe, etc.).  
5. Payment Processing:  
   * Display: Shows a loading/processing indicator (e.g., "Processing your payment...").  
   * System: Backend communicates with the payment gateway.  
6. Upgrade Confirmation / Failure:  
   * A. Success:  
     * System: Payment is successful. User's subscription tier is updated in the backend. Access to new features is enabled.  
     * Screen: Success/Confirmation Screen.  
     * Display: Message like "Upgrade Successful\! You are now on the \[New Tier Name\] plan." Lists key new features unlocked.  
     * UI Feedback: User might be navigated back to the main dashboard or the feature that prompted the upgrade, now with access. A confirmation email/receipt is sent.  
   * B. Failure:  
     * System: Payment fails (e.g., declined card, insufficient funds).  
     * Screen: Error Screen.  
     * Display: Message like "Payment Failed. Please check your payment details and try again." Provides specific error information if available from the gateway.  
     * Actions: Option to "Try Again" (returns to Step 4\) or "Cancel."  
7. (Optional) Manage Existing Subscription (Downgrade/Cancel \- if supported directly in-app):  
   * Note: Downgrades and cancellations are often managed through the respective app store subscription settings (iOS/Android) or a web portal, rather than directly in-app for every scenario. This flow primarily focuses on upgrades.  
   * If supported: User might see options on the "Subscription Management" screen (Step 2\) to manage auto-renewal, view billing history, or initiate a downgrade/cancellation request, which might redirect them to the app store or a web interface.

## **Flow 12: Password Reset/Forgot Password Flow**

Goal: User who has forgotten their password successfully resets it and regains access to their account.

Actors: Existing User (with a registered account)

Preconditions: User is on the Login screen and cannot remember their password.

Steps:

1. Initiate Password Reset:  
   * Screen: Login Screen.  
   * Action: User taps a "Forgot Password?" or "Reset Password" link.  
   * Screen: Password Reset Request Screen.  
2. Enter Registered Email Address:  
   * Display: Prompts the user to enter the email address associated with their account.  
   * Field: Email address input.  
   * Action: User enters their email address and taps "Send Reset Link" or "Submit."  
   * System:  
     * Validates that the email format is correct.  
     * Checks if the email address exists in the user database.  
     * If email exists, generates a unique, time-sensitive password reset token/link and sends it to the user's registered email address.  
     * If email does not exist, displays a generic message (e.g., "If an account exists for this email, a reset link has been sent." \- to avoid confirming/denying email existence for security).  
   * UI Feedback: Confirmation message (e.g., "Password reset instructions sent to your email if an account exists.").  
3. User Receives and Opens Reset Email:  
   * Action (Outside App): User checks their email inbox, finds the password reset email from the app.  
   * Email Content: Contains a unique link or button to reset the password. Explains that the link is time-sensitive.  
4. Access Reset Password Form via Link:  
   * Action (Outside App): User clicks the reset link in the email.  
   * System: The link directs the user to a secure page within the app (if opened on a device with the app) or a web page hosted by the app for password reset. The token in the link is validated.  
   * Screen: New Password Form / Reset Password Screen.  
   * Error Handling:  
     * If link is expired or invalid: Displays an error message (e.g., "This password reset link is invalid or has expired. Please request a new one."). User is directed back to Step 1\.  
5. Enter New Password:  
   * Display: Prompts the user to enter and confirm their new password.  
   * Fields:  
     * New Password  
     * Confirm New Password  
   * Action: User enters their new password in both fields and taps "Reset Password" or "Save New Password."  
   * System:  
     * Validates that the new password meets strength requirements (e.g., length, character types).  
     * Validates that the "New Password" and "Confirm New Password" fields match.  
     * If validation passes, securely updates the user's password in the database. Invalidates the reset token.  
   * UI Feedback (If Validation Fails): Displays error messages (e.g., "Passwords do not match," "Password does not meet requirements.").  
6. Password Reset Confirmation:  
   * Screen: Password Reset Success Screen.  
   * Display: Message like "Your password has been successfully reset. You can now log in with your new password."  
   * Actions: "Log In" button.  
   * Action: User taps "Log In."  
   * Screen: Navigates back to the Login Screen (Flow 1, Step 1, with "Log In" option). User can now log in with their new password.

## **Flow 13: User Deactivating Account Flow**

Goal: User deactivates their account, making it inaccessible but retaining their data for potential future reactivation.

Actors: Existing User (Logged In)

Preconditions: User is logged in and wishes to deactivate their account.

Steps:

1. Navigate to Account Deactivation Option:  
   * Action: User navigates to "Settings/Profile" (Flow 10, Step 1). Within settings, they find an option like "Account Management," "Security," or directly "Deactivate Account."  
   * Screen: Account Management / Deactivate Account initiation screen.  
2. Understand Implications of Deactivation:  
   * Display: The screen clearly explains the consequences of account deactivation:  
     * Their account will become inactive and inaccessible.  
     * Personal data (profile, logged KPIs, PC/GP/VP history, goals, challenge progress) will be retained securely but will not be visible or processed while the account is deactivated.  
     * User can reactivate their account in the future to regain access to their data.  
     * If part of a team, they will appear as "deactivated" or be removed from active team rosters (system policy TBD). Their past contributions might be preserved or anonymized in team views.  
     * If they are a Team Leader, deactivating their account may have implications for their team (e.g., team might become temporarily unmanaged or a co-leader/admin might need to take over; policy TBD).  
     * Active subscriptions through app stores (Apple/Google) typically need to be managed separately by the user via their app store account to prevent future billing. The app should inform them of this.  
   * Action: User reads the information.  
3. Initial Confirmation / "Are You Sure?":  
   * Display: A prompt asking "Are you sure you want to deactivate your account? You can reactivate it later by logging back in."  
   * Action: User must explicitly confirm they wish to proceed (e.g., tap "Deactivate My Account" button). An option to "Cancel" is also present.  
   * Reason for Deactivating: A brief, optional survey asking why the user is deactivating.  
4. Final Verification (e.g., Re-enter Password):  
   * Display: For security, the user is prompted to re-enter their current password to confirm their identity and intent.  
   * Field: Password input.  
   * Action: User enters their password and taps "Confirm Deactivation."  
   * System: Validates the password.  
5. Account Deactivation Processing:  
   * Condition: Password verification is successful.  
   * System:  
     * Sets the user's account status to "deactivated" in the backend.  
     * Revokes active session tokens.  
     * If the user has an active subscription managed by the app's backend (e.g., via Stripe for web), the subscription might be paused or set to not renew, based on policy. For app store subscriptions, the user is reminded again to cancel it via the store.  
     * If the user is a Team Leader, team leadership implications are handled (e.g., notification to admin/co-leader).  
     * Logs the user out.  
   * UI Feedback: A loading/processing indicator (e.g., "Deactivating your account...").  
6. Deactivation Confirmation / Log Out:  
   * Screen: Account Deactivation Success Screen (briefly shown).  
   * Display: Message like "Your account has been successfully deactivated. Your data is saved, and you can reactivate it at any time by logging in."  
   * System: User is automatically logged out and returned to the App Launch/Login screen (Flow 1, Step 1).  
   * Post-Deactivation: User cannot log in normally without going through a reactivation process. Their data is retained.

Important Considerations for Account Deactivation:

* Data Retention Policy & Privacy: The app's privacy policy must clearly state that data for deactivated accounts is retained, for how long, and the user's rights regarding this data (e.g., right to request full deletion under GDPR/CCPA even if deactivated).  
* Reactivation Process: A separate "User Reactivating Account Flow" will need to be defined. This typically involves:  
  * User attempting to log in with credentials of a deactivated account.  
  * System identifying the account as deactivated.  
  * Prompting the user: "This account is deactivated. Would you like to reactivate it?"  
  * User confirms. Account status is set back to "active." User can now log in.  
* Team Leader Deactivation: Clear policy is needed for what happens if a Team Leader deactivates (e.g., if they are the sole leader).  
* Subscription Management: Reiteration of user responsibility for app store subscriptions is key.

## **Flow 14: User Reactivating Account Flow**

Goal: A user with a previously deactivated account successfully reactivates it and regains access.

Actors: User with a deactivated account.

Preconditions:

* User has previously deactivated their account (Flow 13).  
* User's data has been retained by the system.

Steps:

1. Attempt to Log In:  
   * Screen: Login Screen (Flow 1, Step 1, "Log In" option).  
   * Action: User enters the email address and password associated with their previously deactivated account and taps "Log In."  
   * System:  
     * Authenticates credentials.  
     * Checks the account status. If status is "deactivated," proceeds to reactivation prompt.  
     * If credentials are incorrect, standard login error is shown.  
2. Deactivated Account Notification & Reactivation Prompt:  
   * Condition: Credentials are valid, but account status is "deactivated."  
   * Screen: Deactivated Account Notification / Reactivation Prompt Screen.  
   * Display: Message like: "Welcome back, \[User Name\]\! Your account is currently deactivated. Would you like to reactivate it now to regain access to your data and continue using the app?"  
   * Actions: "Reactivate My Account" button, "Cancel" (or "Not Now") button.  
3. User Confirms Reactivation:  
   * Action: User taps "Reactivate My Account."  
   * (Optional) Re-confirm Email/Identity: For added security, especially if a long time has passed, the system might send a verification email with a link to click before proceeding with full reactivation. For simplicity in this flow, we'll assume direct reactivation after prompt confirmation.  
4. Account Reactivation Processing:  
   * System:  
     * Changes the user's account status from "deactivated" to "active" in the backend.  
     * Restores full access to their previously saved data (profile, KPI logs, goals, etc.).  
     * If applicable, re-establishes team memberships (if they were part of a team and the team still exists/policy allows rejoining).  
     * Checks subscription status. If their previous subscription (e.g., via Stripe) was paused, it might prompt them to resume or choose a new plan. App store subscriptions would still be managed by the user.  
   * UI Feedback: Loading/processing indicator (e.g., "Reactivating your account...").  
5. Reactivation Success & Access Granted:  
   * Screen: Reactivation Success Confirmation / Individual Dashboard.  
   * Display: Message like "Your account has been successfully reactivated\! Welcome back."  
   * System: User is logged in.  
   * Action: User is typically navigated directly to their Individual Dashboard (Flow 3), where they can see their restored data.  
   * Post-Reactivation: User can now use the app normally. They may need to review their subscription if it lapsed or was managed externally.

Important Considerations for Account Reactivation:

* Team Status: If the user was part of a team that has since been disbanded, or if their spot was filled, how is this handled? They might revert to a solo account.  
* Challenge Status: What happens to challenges they were part of? If the challenges have ended, they'd see historical data. If ongoing, can they rejoin? (Likely not automatically for fairness unless specific logic is built).  
* Subscription Status: Clear guidance if their previous paid subscription lapsed and they need to re-subscribe to access premium features.  
* Data Integrity: Ensure that the data restoration process is robust.

## **Flow 15: Super Admin Managing Master KPI List**

Goal: A Super Admin creates, edits, or manages the availability of KPIs in the master system catalog.

Actors: Super Admin

Preconditions:

* User is logged in with Super Admin privileges.  
* User is accessing the web-based Admin Dashboard.

Steps:

1. Navigate to KPI Management Section:  
   * Action: Super Admin logs into the Admin Dashboard and navigates to a section like "KPI Catalog," "Master KPI Management," or "System KPIs."  
   * Screen: Master KPI List View.  
2. View Master KPI List:  
   * Display: A table or list of all KPIs currently in the system. For each KPI, it shows:  
     * KPI Name  
     * Type (PC, GP, VP, Custom, Actual, Pipeline\_Anchor)  
     * PC Weight % (if PC type)  
     * TTC Definition (if PC type)  
     * Post-TTC Decay Duration (if PC type)  
     * GP/VP Value (if GP/VP type)  
     * Current Status (e.g., "Enabled," "Disabled")  
     * Date Created/Modified  
   * Actions Available: "Add New KPI" button, Filter/Sort options, "Edit" and "Disable/Enable" actions per KPI row.  
3. Add a New KPI:  
   * Action: Super Admin clicks "Add New KPI."  
   * Screen: Create New KPI Form.  
   * Fields:  
     * KPI Name  
     * KPI Description  
     * KPI Type (Dropdown: PC, GP, VP, Custom, Actual, Pipeline\_Anchor)  
     * Conditional Fields based on Type:  
       * If PC: PC Weight %, TTC Definition, Post-TTC Decay Duration.  
       * If GP/VP: Point Value.  
     * Icon Reference (e.g., dropdown or input for icon name)  
     * Animation Reference  
     * Category (Optional)  
     * Is Enabled (Checkbox, defaults to true)  
   * Action: Super Admin fills in all required details. Clicks "Save KPI" or "Create KPI."  
   * System: Validates input. Creates the new KPI record in the database.  
   * UI Feedback: Confirmation message ("KPI '\[KPI Name\]' created successfully."). New KPI appears in the Master KPI List.  
4. Edit an Existing KPI:  
   * Action: From the Master KPI List (Step 2), Super Admin clicks "Edit" for a specific KPI.  
   * Screen: Edit KPI Form (pre-filled with the selected KPI's current data).  
   * Fields: Same as "Create New KPI Form," all editable.  
   * Action: Super Admin modifies the necessary details. Clicks "Save Changes."  
   * System: Validates input. Updates the KPI record in the database. If core attributes like PC Weight or TTC change, this might have implications for future PC calculations for users (system should handle this gracefully, e.g., changes apply to new logs only, or a recalculation job is considered if historical impact is desired \- policy TBD).  
   * UI Feedback: Confirmation message ("KPI '\[KPI Name\]' updated successfully."). Updated KPI details are reflected in the Master KPI List.  
5. Enable/Disable a KPI:  
   * Action: From the Master KPI List (Step 2), Super Admin clicks an "Enable" or "Disable" toggle/button for a specific KPI.  
   * Confirmation (Especially for Disable): "Are you sure you want to disable '\[KPI Name\]'? Users will no longer be able to select or log this KPI." \[Confirm\] \[Cancel\].  
   * System: If confirmed, updates the KPI's isEnabled status in the database.  
     * If Disabled: The KPI will no longer appear in users' "Available KPIs" lists (Flow 4), cannot be selected for new challenges, etc. Existing logs of this KPI remain for historical data.  
     * If Enabled: The KPI becomes available again for users.  
   * UI Feedback: Status of the KPI updates in the list. Confirmation message.  
6. (Optional) Delete a KPI (Use with Extreme Caution):  
   * Note: Deleting a master KPI can have significant data integrity implications if users have already logged it or if it's part of challenge templates/active challenges. Disabling is generally preferred.  
   * Action: If a "Delete" option is provided (e.g., for KPIs created in error and never used), Super Admin clicks "Delete."  
   * Confirmation (Strong): "WARNING: Deleting '\[KPI Name\]' is permanent and may affect historical data and active challenges. Are you absolutely sure? Type 'DELETE' to confirm."  
   * System: If confirmed, and if system rules allow (e.g., no active logs/challenge associations), the KPI record is removed from the database.  
   * UI Feedback: KPI is removed from the list. Strong confirmation message.

## **Flow 16: Super Admin Managing Challenge Templates**

Goal: A Super Admin creates, edits, or manages the availability of preset challenge templates offered to users.

Actors: Super Admin

Preconditions:

* User is logged in with Super Admin privileges.  
* User is accessing the web-based Admin Dashboard.  
* Master KPI List is populated (as challenge templates will reference these KPIs).

Steps:

1. Navigate to Challenge Template Management Section:  
   * Action: Super Admin logs into the Admin Dashboard and navigates to a section like "Challenge Templates," "Preset Challenges," or "System Challenges."  
   * Screen: Challenge Template List View.  
2. View Existing Challenge Templates:  
   * Display: A table or list of all preset challenge templates currently in the system. For each template, it shows:  
     * Template Name  
     * Brief Description  
     * Default Duration  
     * Number of Associated KPIs  
     * Predefined Label/Icon  
     * Current Status (e.g., "Enabled," "Disabled")  
     * Date Created/Modified  
   * Actions Available: "Add New Template" button, Filter/Sort options, "Edit" and "Disable/Enable" actions per template row.  
3. Add a New Challenge Template:  
   * Action: Super Admin clicks "Add New Template."  
   * Screen: Create New Challenge Template Form.  
   * Fields:  
     * Template Name  
     * Template Description  
     * Goal Description (e.g., "Log 5 New Clients and 20 Sphere Calls")  
     * Default Duration (e.g., in days)  
     * Select Associated KPIs (Multi-select from Master KPI List; typically 3-6 KPIs)  
     * Predefined Label/Icon (Select from a library or upload)  
     * Is Enabled (Checkbox, defaults to true)  
     * (Optional) Default mode (Solo, Team, or User Selectable)  
   * Action: Super Admin fills in all required details. Clicks "Save Template" or "Create Template."  
   * System: Validates input. Creates the new challenge template record in the database, linking to the selected Master KPIs.  
   * UI Feedback: Confirmation message ("Challenge Template '\[Template Name\]' created successfully."). New template appears in the list.  
4. Edit an Existing Challenge Template:  
   * Action: From the Challenge Template List (Step 2), Super Admin clicks "Edit" for a specific template.  
   * Screen: Edit Challenge Template Form (pre-filled with the template's current data).  
   * Fields: Same as "Create New Challenge Template Form," all editable.  
   * Action: Super Admin modifies the necessary details. Clicks "Save Changes."  
   * System: Validates input. Updates the challenge template record. Edits to a template will apply only to new challenges started from this template henceforth. Active challenges already started by users based on a previous version of the template will continue unaffected.  
   * UI Feedback: Confirmation message ("Challenge Template '\[Template Name\]' updated successfully."). Updated template details are reflected in the list.  
5. Enable/Disable a Challenge Template:  
   * Action: From the Challenge Template List (Step 2), Super Admin clicks an "Enable" or "Disable" toggle/button for a specific template.  
   * Confirmation (Especially for Disable): "Are you sure you want to disable the '\[Template Name\]' challenge template? Users will no longer be able to start new challenges based on this template." \[Confirm\] \[Cancel\].  
   * System: If confirmed, updates the template's isEnabled status.  
     * If Disabled: The template will no longer appear in users' "Challenge Selection Screen" (Flow 5). Active challenges already started from this template will continue unaffected until they end.  
     * If Enabled: The template becomes available again for users to select.  
   * UI Feedback: Status of the template updates in the list. Confirmation message.  
6. (Optional) Delete a Challenge Template (Use with Caution):  
   * Note: Deleting a template is generally less risky than deleting a master KPI, but if many users have historical data from challenges based on this template, disabling is often preferred.  
   * Action: If a "Delete" option is provided, Super Admin clicks "Delete."  
   * Confirmation (Strong): "WARNING: Deleting the '\[Template Name\]' challenge template is permanent. Historical challenge data based on this template may lose context. Are you absolutely sure? Type 'DELETE' to confirm."  
   * System: If confirmed, the challenge template record is removed.  
   * UI Feedback: Template is removed from the list. Strong confirmation message.

## **Flow 17: Super Admin Viewing System Analytics & User Overview (with Data Export)**

Goal: A Super Admin views overall system usage statistics, key metrics, can get an overview of users, manually add new users, and export data for in-depth analysis.

Actors: Super Admin

Preconditions:

* User is logged in with Super Admin privileges.  
* User is accessing the web-based Admin Dashboard.

Steps:

1. Navigate to Analytics/User Overview Section:  
   * Action: Super Admin logs into the Admin Dashboard and navigates to a section like "Dashboard," "System Analytics," "Usage Statistics," or "User Management."  
   * Screen: Admin Dashboard \- Main Analytics View / User Overview.  
2. View Key System Metrics (Dashboard Widgets):  
   * Display: The main view typically presents several widgets or cards showing high-level statistics (Total Active Users, New Registrations, Subscription Breakdown, KPI Logging Activity, Challenge Engagement, etc.).  
   * Filtering: Options to filter some metrics by date range.  
   * Action: Super Admin reviews the overall health and activity of the application.  
3. Access User Management/Search:  
   * Display: A section or tab for "User Management" or a prominent "Search Users" bar. An "Add New User" button and potentially an "Export User List" button are visible.  
   * Action: Super Admin clicks on "User Management" to view the list, uses the search bar, clicks "Add New User," or "Export User List."  
   * Screen: User List / Search Results View / Add New User Form.  
4. View and Filter User List & Export User Data:  
   * Display: A paginated table or list of all registered users (showing User ID, Name, Email, Reg Date, Last Login, Tier, Status, Team).  
   * Actions Available: Filter, Sort, Search, View User Details, "Add New User" button.  
   * New Action: Export User List:  
     * Super Admin clicks an "Export User List" or "Download CSV" button.  
     * System Prompt (Optional): May prompt for specific fields to include or date ranges for activity.  
     * System: Generates a CSV/Excel file of the current filtered user list (or all users) with selected fields. File is downloaded to the Super Admin's computer.  
5. Manually Add a New User:  
   * Action: Super Admin clicks the "Add New User" button.  
   * Screen: Create New User Form (Admin).  
   * Fields:  
     * Full Name  
     * Email Address  
     * Initial Password (Admin sets this; system should recommend/enforce strong passwords)  
     * Confirm Initial Password  
     * User Role (Dropdown: e.g., User, Team Leader, Super Admin \- with appropriate warnings for assigning Super Admin)  
     * Subscription Tier (Dropdown: Free, Basic, Teams, Enterprise)  
     * (Optional) Average Property Price Point (for PC calculations)  
     * (Optional) Typical Commission Rate (for PC calculations)  
     * (Optional) Assign to Team (if creating a team member, search/select existing team)  
   * Action: Super Admin fills in all required details. Clicks "Create User."  
   * System:  
     * Validates input (e.g., email uniqueness, password strength).  
     * Creates the new user account with the specified details and an "active" status.  
     * Security Note: It's highly recommended that the system flags this user to change their admin-assigned password upon their first login.  
   * UI Feedback: Confirmation message ("User '\[User Name\]' created successfully. They should be advised to change their password on first login."). New user appears in the User List.  
6. View Specific User Details (Read-Only Overview for Admin):  
   * Action: Super Admin clicks on a user from the list or search result.  
   * Screen: User Detail View (Admin Perspective).  
   * Display: Shows a summary of the selected user's information:  
     * Profile details (name, email, registration date, etc.).  
     * Current tier, subscription history (if available).  
     * Account status.  
     * Team membership.  
     * High-level activity summary (e.g., last login, total KPIs logged, number of active challenges).  
     * (No access to sensitive personal data or detailed private logs beyond what's necessary for admin functions).  
   * Actions Available (Limited for general overview):  
     * Change User Role/Tier (If Needed): Might be an option for specific administrative overrides.  
     * Deactivate/Reactivate Account (Admin Override): For support purposes.  
     * View Activity Log (High-Level): E.g., login history, major account changes.  
     * New Action (Contextual Export): Option to "Export Activity Log for this User (CSV)" for a specified date range.  
     * (No "Edit Profile" in the sense of changing user's name/password directly by admin, other than initial password reset mechanisms if needed).  
7. Access Detailed Analytics Reports & Data Exports:  
   * Action: Super Admin navigates to a dedicated "Reports" or "Data Exports" section (or from Step 2 widgets, a "View Detailed Report" link).  
   * Screen: Detailed Reports / Data Export Configuration Screen.  
   * Display: Options to view more granular reports and configure data exports:  
     * Pre-defined Reports:  
       * Detailed Subscription/Revenue Reports (if backend tracks).  
       * In-depth Challenge Analytics (participation, completion rates, popular KPIs).  
       * KPI Popularity & Usage Reports (overall and trends).  
       * User Retention/Churn Analysis.  
     * Data Export Configuration:  
       * Select Data Type: (e.g., "KPI Logs," "Challenge Participation," "User Activity Summary").  
       * Filter by Date Range.  
       * Filter by User Segment/Tier (Optional).  
       * Select Fields for Export.  
       * Choose Format (CSV default, Excel if minimal extra effort).  
   * Action: Super Admin configures and generates a report to view in-app (if dashboard style) OR configures and initiates a data export (CSV/Excel download).  
   * UI Feedback: Report displays or file download initiates. Confirmation message.

# Tab 6

## **Flow 1: Onboarding & Subscription Setup**

**Goal:** Seamlessly guide new users into the app with personalized PC/GP/VP setup, subscription tier selection, and KPI defaults.

**Actors:**

* New User  
* System

**Preconditions:**

* User has downloaded and opened the app for the first time.

**Steps:**

1. **Welcome & Quick Value Proposition**  
   * Screen: Engaging intro slides explaining PC (Projected Commissions), GP (Growth Points), and VP (Vitality Points).  
   * Short, inspiring copy: *“Track your sales. Grow your skills. Fuel your vitality.”*  
2. **Account Creation**  
   * User chooses to sign up via email/password, Google, or Apple login.  
   * Email verification required before proceeding.  
3. **Initial Personalization**  
   * Capture average sale price & commission % (used to calculate PC, but do not display example projections yet per your rule).  
   * User selects primary role (Solo Agent / Team Leader / Team Member).  
4. **Subscription Selection**  
   * Tiers presented:  
     * **Free** – 5 PC KPIs, 5 GP KPIs, 5 VP KPIs, no custom KPIs.  
     * **Basic** – Unlimited KPIs, no custom KPIs.  
     * **Pro** – Unlimited \+ custom KPIs.  
   * Users choose monthly or annual billing.  
5. **Initial KPI Setup**  
   * Based on role and tier, preselect KPI defaults for PC, GP, and VP.  
   * User may deselect/add KPIs within their tier’s limits.  
6. **Team Invite or Creation (if applicable)**  
   * Team Leaders can create a team now.  
   * Team Members can join via code or invite link.  
7. **Tutorial Prompt**  
   * Optional walk-through of the dashboard and tap-to-log system.

---

## **Flow 2: KPI Logging & Forecast Confidence**

**Goal:** Allow users to quickly log KPIs while keeping PC forecast accuracy high.

**Actors:**

* User  
* System

**Preconditions:**

* User is logged in.  
* At least one KPI is active in each applicable currency.

**Steps:**

1. **Access Logging Screen**  
   * Tap-to-log buttons grouped by PC, GP, VP.  
   * Visual/haptic/audio feedback for each currency type.  
2. **Logging Action**  
   * Tap instantly records KPI completion.  
   * If KPI is linked to a challenge, challenge icon appears.  
   * Multiple challenge memberships show stacked icons or numeric \+ tooltip.  
3. **Backdating Rules**  
   * Backdated logs update totals/history but **do not** reset Forecast Confidence activity decay timers.  
4. **Forecast Confidence Updates**  
   * **Tier 1 Modifier:** Recency of KPI activity adjusts PC totals.  
   * **Tier 2 Modifier:** Historical accuracy adjusts confidence score.  
   * Confidence meter color-coded with tooltip explanations.  
5. **Secondary KPI Options**  
   * For calls, “Conversations Achieved” can be logged in the same tap flow.

---

## **Flow 3: Challenge Participation & Progress Tracking**

**Goal:** Drive focused bursts of activity with individual or team-based goals.

**Actors:**

* User (Participant)  
* Team Leader (for team challenges)  
* System

**Preconditions:**

* User is logged in.  
* Challenge is active.

**Steps:**

1. **Join Challenge**  
   * Users may join from the Challenge Showcase or via team invite.  
2. **Challenge Modes**  
   * **Individual** – personal progress tracked.  
   * **Team** – contribution % tracked; leaderboard visible.  
3. **KPI Targets & Logging**  
   * Challenge KPIs are highlighted in the logging interface.  
   * Progress bars update in real time.  
4. **Unlock Conditions for GP/VP**  
   * GP meter unlocks after **3 days** of activity **or** 20 logged KPIs.  
   * VP meter unlocks after **7 days** of activity **or** 40 logged KPIs.  
5. **Completion & Rewards**  
   * End-of-challenge animations for meeting targets.  
   * GP/VP added to respective meters, contributing to visual growth systems.

---

## **Flow 4: KPI Selection & Management**

**Goal:** Allow users to customize KPIs within subscription limits.

**Actors:**

* User  
* System

**Preconditions:**

* User has an active account and tier.

**Steps:**

1. **Access KPI Management**  
   * From settings or dashboard.  
2. **Display Available KPIs**  
   * System KPIs listed under PC, GP, VP (with optional Custom per tier).  
   * `Deal Closed` and `Pipeline Anchor` items are excluded from this add/remove selection surface.  
   * Custom KPIs only available to Pro tier.  
3. **Add/Remove KPIs**  
   * Subscription rules enforced (Free tier: max 5 per category).  
   * Locked KPIs remain visible with upgrade affordance rather than hidden removal from the catalog.  
4. **Team-Mandatory KPIs**  
   * If in a team, mandatory KPIs are locked and non-removable.

---

## **Flow 5: PC/GP/VP Meter Behavior**

**Goal:** Visually represent user’s progress and trigger motivational animations.

**Actors:**

* User  
* System

**Preconditions:**

* Meters visible on dashboard.

**Steps:**

1. **PC Meter**  
   * Updates with real-time number flip \+ value float-up when PC KPI is logged.  
2. **GP Gear Visual**  
   * Unlock tiers: Ignition → Engaged → Streamlined → Scaling.  
   * Decay starts 2 weeks after last GP activity (25 GP/week).  
3. **VP Tree Visual**  
   * Tiers: Stable → Energized → Thriving → Overflowing.  
   * Decay mirrors GP model but with vitality-themed animations.

---

## **Flow 6: Team Creation & Membership**

**Goal:** Enable creation, joining, and management of teams.

**Actors:**

* Team Account Owner (Leader)  
* Team Member  
* System

**Preconditions:**

* User has a paid account (Basic or Pro) for team creation.

**Steps:**

1. **Create Team**  
   * Only Team Account Owners can create/lead.  
   * Can lead multiple teams.  
2. **Join Team**  
   * Via invite email or join code.  
3. **Transfer Leadership**  
   * If leader leaves: must assign another Team Account Owner or delete team.  
   * If leaderless, Super Admin can reassign.

---

## **Appendix B – Subscription Rules**

**Free Tier:**

* Max 5 PC, 5 GP, 5 VP KPIs.  
* No custom KPIs.  
* Join up to 2 challenges.

**Basic Tier:**

* Unlimited KPIs.  
* No custom KPIs.  
* Join up to 5 challenges.

**Pro Tier:**

* Unlimited KPIs.  
* Custom KPI creation.  
* Unlimited challenges.  
* Create & host custom challenges.

---

## **Appendix C – Data & Privacy Rules**

1. **Data Retention:** Historical charts and analytics retain KPI/challenge data even if the item is disabled or deleted, but the item is marked as *retired* in reporting.  
2. **GDPR/CCPA Compliance:** Admin exports must respect privacy rules and include a compliance check if exporting personal data.  
3. **Backdating Rules:** Backdated entries update historical records but do not alter activity decay or forecast confidence.

---

# Mockup of Screens

# **Mockup of Screens**

## **1\. Onboarding Flow**

**Purpose:** To collect initial user information and set up their app experience.

**Visuals & Interaction:**

* Multi-step flow with clear input fields; each step is a separate screen or progressive form.  
* **Step 1:** Fields for Name, Email.  
* **Step 2:** Fields for Average Price Point, Commission Percentage.  
* **Step 3:** Input fields for Projected GCI Goal, Actual GCI Goal, Deals Closed Goal.  
* **Step 4 (Optional):** Option to assign to a team, with search or selection interface.  
* **Step 5:** Selection interface (checkboxes/toggles) to choose KPIs for the main Tap-to-Log screen.

**Navigation:** “Next” and “Back” buttons, plus progress indicator.

---

## **2\. Individual Dashboard**

**Purpose:** Quick overview of personal performance across all key metrics.

**Visuals & Interaction:**

* **Top Section:** Displays Actual GCI and Deals Closed counters.  
* **Main Section:** Three animated meters:  
  * **Projected Commissions (PC):** Coin-style meter with forecast confidence overlay (Green \= Accurate, Yellow \= Mixed, Red \= Overprojecting).  
  * **Growth Points (GP):** Industrial gears/glowing city theme; decays visually after 2 weeks of inactivity.  
  * **Vitality Points (VP):** Growing tree theme; decays visually after a grace period.  
* **Overall:** Clean, uncluttered, numerical displays alongside animations.

  ---

  ## **3\. Tap-to-Log Screen (Swipeable by Currency)**

**Purpose:** To log daily activities (KPIs) quickly.

**Visuals & Interaction:**

* **Swipeable Panels:** Horizontally switch between:  
  * **Projected Commissions (PC):** Coin-style meter with forecast confidence overlay; represents potential earnings.  
  * **Growth Points (GP):** Industrial gears/glowing city meter; represents business growth and skill development; decays after 2 weeks inactivity.  
  * **Vitality Points (VP):** Growing tree meter; represents personal health and energy; decays after grace period.  
  * **Custom:** KPIs without currency value.  
* **KPI Buttons:** Up to 6 large buttons per panel, each representing a KPI.  
* **Visual Feedback:**  
  * Point float-up animation (e.g., "$187.50", "+10 GP", "+5 VP").  
  * Corresponding currency meter updates smoothly.  
  * Haptic feedback and sound effect.  
* **Secondary Interaction:** For call-related PC KPIs, embedded “Conversations Achieved” tracker.

  ---

  ## **4\. Challenge View (Active Challenge)**

**Purpose:** Display progress and details of an ongoing challenge.

**Visuals & Interaction:**

* Challenge header with name, time remaining, % complete.  
* KPI progress bars for 6 challenge KPIs; logging triggers currency-specific animation.  
* Team leaderboard snippet (real-time, top members).  
* Invite teammates option (if team mode).

  ---

  ## **5\. Challenge Selection Screen**

**Purpose:** Browse and start new challenges.

**Visuals & Interaction:**

* Challenge cards/list (10 preset templates) with:  
  * Name, description, goal, duration.  
  * Solo/Team toggle.  
  * Start button.

    ---

    ## **6\. Challenge Creation Screen (Teams Package)**

**Purpose:** Build custom challenges for teams.

**Visuals & Interaction:**

* Form fields for name, description, duration.  
* KPI selection (3–6 KPIs from all currencies \+ custom).  
* Participant selection.  
* Launch button.  
* Locked for non-Teams tier.

  ---

  ## **7\. Sponsored Challenge Showcase**

**Purpose:** Display sponsored/branded challenges with unique incentives.

**Visuals & Interaction:**

* Challenge feed/grid styled differently (logos, colored backgrounds).  
* Challenge card includes sponsor info, reward summary, dates, join button.  
* Detail view with full description, sponsor CTA, reward disclaimer, progress.  
* Joining animates relevant KPI meters.

**Figma Requirements:**

* Showcase screen, detail view, CTA popup.

  ---

## **8\. KPI Selection Screen**

**Purpose:** Customize which KPIs appear on Tap-to-Log.

**Visuals & Interaction:**

* Master list of KPIs by category (PC, GP, VP).  
* Each KPI shows name, icon, animation type, value.  
* Add/remove toggles.
* Show a recommended starter subset (3-5) first, with immediate access to the full catalog.
* Keep tier-restricted KPIs visible as locked entries with upgrade CTA behavior.
* Do not render `Deal Closed` or `Pipeline Anchor` items as selectable add/remove entries on this screen.

  ---

  ## **9\. Team Dashboard**

**Purpose:** Overview of team performance.

**Visuals & Interaction:**

* Aggregated team meters for PC, GP, VP, Deals Closed.  
* Member rows with avatar, metric progress bars, rank change animations.  
* Team management tools (create/invite/leave/view roster).

  ---

  ## **10\. Settings/Profile**

**Purpose:** Manage account, preferences, goals.

**Visuals & Interaction:**

* Account management.  
* Preferences (notifications, sound, haptics).  
* Goal adjustment.  
* Team invite management.

  ---

  ## **11\. Subscription & Tiers Screen**

**Purpose:** Display plans and upsell upgrades.

**Visuals & Interaction:**

* Tier breakdown (Free, Basic, Teams, Enterprise).  
* Locked feature indicators.  
* Upgrade CTA.

  ---

  ## **12\. Coaching Promotion Screen**

**Purpose:** Promote coaching services.

**Visuals & Interaction:**

* Banner with "Need help with your KPIs?"  
* Standard version: links to centralized booking.  
* Enterprise version: dynamic CTA linking to internal coaching resource.


# API Contract 2.0

# **API Contract (Updated & Expanded) \- KPI Tracker App**

Version: 0.3

Date: May 29, 2025

Base URL: /api/v1

Authentication: All endpoints require Bearer Token authentication (JWT) unless otherwise specified.

Common Error Responses:

* 400 Bad Request: Invalid request payload, missing parameters.

{ "error": "Invalid input", "details": "Field 'email' is required." }

*   
* 401 Unauthorized: Missing or invalid authentication token.

{ "error": "Authentication required." }

*   
* 403 Forbidden: Authenticated user does not have permission to access the resource.

{ "error": "You do not have permission to perform this action." }

*   
* 404 Not Found: Resource not found.

{ "error": "Resource not found." }

*   
* 500 Internal Server Error: Unexpected server error.

{ "error": "An unexpected error occurred." }

* 

## **1\. Users & Authentication**

### **1.1.** POST /auth/register

* Description: Register a new user.  
* Request Body: (As previously defined)  
* Success Response (201 Created): (As previously defined)

### **1.2.** POST /auth/login

* Description: Log in an existing user. If account was deactivated, this action will reactivate it.  
* Request Body: (As previously defined)  
* Success Response (200 OK): (As previously defined, including accountStatus)

### **1.3.** GET /users/me

* Description: Get current authenticated user's profile.  
* Success Response (200 OK): (As previously defined)

### **1.4.** PUT /users/me

* Description: Update current authenticated user's profile (e.g., goals, average price point).  
* Request Body: (As previously defined)  
* Success Response (200 OK): (Returns updated user profile)

### **1.5.** POST /users/me/deactivate

* Description: Allows the authenticated user to deactivate their own account.  
* Request Body (Optional, may require password confirmation): (As previously defined)  
* Success Response (200 OK): (As previously defined)

### **1.6.** PUT /users/me/notification-preferences **(NEW)**

* Description: Update the user's notification preferences.  
* Request Body:

{  
  "challengeNotificationsEnabled": true,  
  "coachingMessagesEnabled": true,  
  "teamActivitySummariesEnabled": false,  
  "promotionalAnnouncementsEnabled": true  
}

*   
* Success Response (200 OK): (Returns updated preferences object)

## **2\. KPIs (Key Performance Indicators)**

### **2.1.** GET /kpis **(Master System KPIs)**

* Description: Get a list of all available system-defined KPIs (PC, GP, VP, Actual, Anchors).  
* Query Parameters (Optional): (As previously defined)  
* Success Response (200 OK): (As previously defined)

### **2.2.** GET /kpis/{kpiId} **(Master System KPI Detail)**

* Description: Get details for a specific system-defined KPI.  
* Success Response (200 OK): (Single KPI object)

### **2.3. User-Defined Custom KPIs (NEW SECTION)**

Policy note:
- In current scope, user-defined Custom KPIs are metadata-only (`name`, `description`, `iconReference`) and currency-neutral.
- User-defined Custom KPI create/update flows must not accept user-editable payout/value/weight fields.
- Any future Custom KPI value-weight model requires explicit admin-governed design and contract updates.

#### **2.3.1.** POST /users/me/custom-kpis

* Description: Create a new custom KPI for the authenticated user.  
* Request Body:

{  
 "name": "My Custom Prospecting Task",  
  "description": "Tracks my unique outreach method.",  
  "iconReference": "icon\_custom\_star" // Optional  
}

*   
* Success Response (201 Created): (Returns the newly created custom KPI object, including its system-generated kpiId and type: "Custom")

#### **2.3.2.** GET /users/me/custom-kpis

* Description: Get a list of all custom KPIs created by the authenticated user.  
* Success Response (200 OK): (Array of custom KPI objects)

#### **2.3.3.** PUT /users/me/custom-kpis/{customKpiId}

* Description: Update an existing custom KPI created by the authenticated user.  
* Request Body:

{  
  "name": "Updated Custom Task",  
  "description": "Revised description.",  
  "iconReference": "icon\_custom\_updated\_star"  
}

*   
* Success Response (200 OK): (Returns the updated custom KPI object)

#### **2.3.4.** DELETE /users/me/custom-kpis/{customKpiId}

* Description: Delete a custom KPI created by the authenticated user.  
* Success Response (204 No Content):

## **3\. Logging**

### **3.1.** POST /logs/kpi

* Description: Log a KPI activity for the authenticated user (system-defined or user's own custom KPI).  
* Request Body: (As previously defined)  
* Success Response (201 Created): (As previously defined)

### **3.2.** POST /logs/pipeline-anchor

* Description: Update the status/count of a Pipeline Anchor for the user.  
* Request Body: (As previously defined)  
* Success Response (200 OK): (As previously defined)

### **3.3.** GET /users/me/dashboard-data

* Description: Get consolidated data for the user's dashboard.  
* Success Response (200 OK): (As previously defined)

## **4\. Challenges**

### **4.1.** GET /challenges/templates

* Description: Get a list of available challenge templates.  
* Success Response (200 OK): (As previously defined, including challengeLabelIcon)

### **4.2.** POST /challenges/active **(Joining a Preset Challenge)**

* Description: User joins a new challenge based on a preset template.  
* Request Body: (As previously defined)  
* Success Response (201 Created): (Returns details of newly active challenge instance, see 4.5)

### **4.3.** POST /challenges/custom **(Team Leader Creating Custom Challenge)**

* Description: A Team Leader creates a new custom challenge for their team.  
* Request Body: (As previously defined)  
* Success Response (201 Created): (Returns details of newly active challenge instance, see 4.5)

### **4.4.** GET /challenges/active

* Description: Get the user's currently active challenges.  
* Success Response (200 OK): (Array of active challenge objects, structure as in 4.5)

### **4.5.** GET /challenges/active/{activeChallengeId}

* Description: Get details and progress for a specific active challenge.  
* Success Response (200 OK): (As previously refined, including detailed KPI breakdown with goalType, targetValue, progress, and contributions)

### **4.6.** POST /challenges/active/{activeChallengeId}/invite

* Description: Team Leader invites more team members, or individual invites a friend to a shared solo challenge.  
* Request Body: (As previously defined)  
* Success Response (200 OK): (As previously defined)

### **4.7.** POST /challenges/active/{activeChallengeId}/late-add-decision

* Description: Challenge maker decides whether to include prior logs for a late-added participant.  
* Request Body: (As previously defined)  
* Success Response (200 OK): (As previously defined)

### **4.8.** DELETE /challenges/active/{activeChallengeId}/leave

* Description: User leaves an active challenge.  
* Success Response (200 OK): (As previously defined)

### **4.9.** GET /challenges/active/{activeChallengeId}/leaderboard

* Description: Get the leaderboard for a specific active team challenge.  
* Success Response (200 OK): (As previously defined, including contributionPercent)

### **4.10. GET /challenges/sponsored**

* **Description:**Retrieve a list of currently available sponsored challenges visible to the user.  
* **Query Parameters (Optional):**  
* status: active | upcoming | archived  
* sponsorId: Filter by sponsor (if admin or analytics use)

**Success Response (200 OK):**

\[  
  {  
    "sponsoredChallengeId": "uuid\_sponsored\_abc",  
    "title": "30-Day Follow-Up Blitz",  
    "sponsor": {  
      "name": "First Horizon Mortgage",  
      "logoUrl": "https://example.com/logo.png",  
      "ctaLabel": "Get Preapproved",  
      "ctaUrl": "https://example.com/preapproval"  
    },  
    "rewardSummary": "$100 Amazon Gift Card",  
    "startDate": "2025-07-01",  
    "endDate": "2025-07-30",  
    "previewImageUrl": "https://example.com/preview.jpg",  
    "joinable": true,  
    "joined": false  
  }  
\]

## **5\. Teams (Team Leader Management \- NEW SECTION)**

### **5.1.** GET /teams/me

* Description: If the user is part of a team, get details of their current team(s). If a Team Leader, may return more comprehensive details for teams they lead.  
* Success Response (200 OK):

\[ // Array if user can be in multiple teams, or single object  
  {  
    "teamId": "team\_uuid\_xyz",  
    "name": "The A-Team",  
    "leaderUserIds": \["leader\_user\_uuid"\],  
    "memberCount": 5,  
    "mandatoryKpiIds": \["kpi\_id\_sphere\_call"\] // If set  
  }  
\]

* 

### **5.2.** POST /teams **(Team Leader Creating a Team)**

* Description: A user (likely on a specific plan) creates a new team, becoming its leader.  
* Request Body:

{  
  "teamName": "The Dominators"  
}

*   
* Success Response (201 Created): (Returns new team details, including the creator as leader)

### **5.3.** GET /teams/{teamId}/members **(Team Leader)**

* Description: Team Leader gets a list of their team members.  
* Success Response (200 OK):

\[  
  { "userId": "user\_uuid\_member1", "name": "John Smith", "joinDate": "2025-01-15T..." },  
  { "userId": "user\_uuid\_member2", "name": "Alice Brown", "joinDate": "2025-02-01T..." }  
\]

* 

### **5.4.** POST /teams/{teamId}/invites **(Team Leader)**

* Description: Team Leader invites users to their team.  
* Request Body:

{  
  "inviteeEmails": \["newmember1@example.com", "newmember2@example.com"\]  
}

*   
* Success Response (200 OK):

{ "message": "Team invitations sent." }

* 

### **5.5.** DELETE /teams/{teamId}/members/{memberUserId} **(Team Leader)**

* Description: Team Leader removes a member from their team.  
* Success Response (200 OK):

{ "message": "Member removed from team." }

* 

### **5.6.** PUT /teams/{teamId}/mandatory-kpis **(Team Leader)**

* Description: Team Leader sets or updates the list of team-wide mandatory KPIs.  
* Request Body:

{  
  "mandatoryKpiIds": \["kpi\_id\_call", "kpi\_id\_appointment"\]  
}

*   
* Success Response (200 OK): (Returns updated list of mandatory KPI IDs for the team)

## **6\. Subscriptions (NEW SECTION)**

### **6.1.** GET /subscriptions/plans

* Description: Get a list of available subscription plans/tiers and their features.  
* Success Response (200 OK):

\[  
  {  
    "planId": "free\_tier", "name": "Free", "priceMonthly": 0, "priceAnnually": 0,  
    "features": \["Basic KPI Tracking", "1 Active Challenge (Promotional Only)"\]  
  },  
  {  
    "planId": "basic\_solo\_monthly", "name": "Basic Solo", "priceMonthly": 9.99,  
    "features": \["Full KPI Tracking", "1 Active Predefined Challenge"\]  
  },  
  {  
    "planId": "teams\_monthly", "name": "Teams", "priceMonthly": 29.99,  
    "features": \["All Basic Features", "Team Dashboard", "Unlimited Challenges", "Custom Challenges"\]  
  }  
  // ... other plans like annual versions, enterprise  
\]

* 

### **6.2.** POST /subscriptions

* Description: User initiates a new subscription or changes their existing one (primarily for web/Stripe). The client would have obtained a payment method token from Stripe. For mobile IAP, the client sends validated purchase receipt data.  
* Request Body (Example for Stripe):

{  
  "planId": "teams\_monthly",  
  "paymentMethodToken": "stripe\_payment\_method\_token\_abc" // From Stripe.js  
  // Or for mobile:  
  // "receiptData": "apple\_or\_google\_receipt\_data",  
  // "gateway": "apple" // or "google"  
}

*   
* Success Response (200 OK or 201 Created):

{  
  "subscriptionId": "sub\_uuid\_efg",  
  "planId": "teams\_monthly",  
  "status": "active", // or "trialing"  
  "nextBillingDate": "2025-06-29"  
}

*   
  * *Backend handles creating/updating subscription with Stripe/validating IAP receipt and updating local DB.*

## **7\. Admin API Endpoints (Explicitly Listed \- NEW SECTION)**

*(All endpoints require Super Admin role authentication)*

### **7.1. Master KPI Catalog Management (Corresponds to Project Plan 4.8.1)**

* GET /admin/kpis  
* POST /admin/kpis  
* GET /admin/kpis/{kpiId}  
* PUT /admin/kpis/{kpiId}  
* PATCH /admin/kpis/{kpiId}/status  
* DELETE /admin/kpis/{kpiId}  
  * *(Request/Response structures as implied by Flow 15 & Project Plan 4.3 \- KPIs Data Model)*

### **7.2. Challenge Template Management (Corresponds to Project Plan 4.8.2)**

* GET /admin/challenge-templates  
* POST /admin/challenge-templates  
* GET /admin/challenge-templates/{templateId}  
* PUT /admin/challenge-templates/{templateId}  
* PATCH /admin/challenge-templates/{templateId}/status  
* DELETE /admin/challenge-templates/{templateId}  
  * *(Request/Response structures as implied by Flow 16 & Project Plan 4.3 \- Challenge\_Templates Data Model)*

### **7.3. System Analytics & Usage Statistics (Corresponds to Project Plan 4.8.3)**

* GET /admin/analytics/overview  
* GET /admin/analytics/detailed-reports (if more specific report endpoints are defined)  
  * *(Response structures as implied by Flow 17 & Project Plan 4.8.3)*

### **7.4. User Management (Corresponds to Project Plan 4.8.4)**

* GET /admin/users  
* POST /admin/users (for manual creation by admin)  
* GET /admin/users/{userId}  
* PUT /admin/users/{userId}/role  
* PUT /admin/users/{userId}/tier  
* PUT /admin/users/{userId}/status (activate/deactivate)  
  * *(Request/Response structures as implied by Flow 17 & Project Plan 4.3 \- Users Data Model)*

### **7.5. Data Export Functionality (Corresponds to Project Plan 4.8.5)**

* POST /admin/data-exports  
  * *(Request specifies data type, filters; Response provides download link/file stream, as per Project Plan 4.8.5)*

### **7.6. Sponsored Challenge Management (Corresponds to Project Plan 4.8.6 \- Future)**

**Endpoints:**

* POST /admin/sponsored-challenges  
  Create a new sponsored challenge.  
* PUT /admin/sponsored-challenges/{sponsoredChallengeId}  
  Update challenge details, visibility dates, and linked KPIs.  
* PATCH /admin/sponsored-challenges/{sponsoredChallengeId}/status  
  Approve, pause, or archive a challenge.  
* DELETE /admin/sponsored-challenges/{sponsoredChallengeId}  
  Soft-delete a challenge (removes it from public feed).  
* GET /admin/sponsored-challenges  
  Retrieve all challenges (for dashboard/admin UI).

**Request Body for Creation Example:**

{  
  "title": "30-Day Follow-Up Blitz",  
  "sponsor": {  
    "name": "First Horizon Mortgage",  
    "logoUrl": "https://example.com/logo.png",  
    "ctaLabel": "Get Preapproved",  
    "ctaUrl": "https://example.com/preapproval"  
  },  
  "rewardSummary": "$100 Amazon Gift Card",  
  "description": "Track 25 follow-up calls in 30 days.",  
  "kpiTargets": \[  
    { "kpiId": "kpi\_id\_followup\_call", "target": 25 }  
  \],  
  "startDate": "2025-07-01",  
  "endDate": "2025-07-30",  
  "previewImageUrl": "https://example.com/challenge\_card.png"  
}

### **7.7. Content Management for Coaching/Notifications (Corresponds to Project Plan 4.8.7 \- If Centralized)**

* (Endpoints TBD, e.g., GET /admin/coaching-messages, POST /admin/coaching-messages)

**Success Response (201 Created):**

{ "sponsoredChallengeId": "uuid\_generated" }

# Calcs and Algorithmns

**Developer Calculation Document: KPI Tracker App Core Logic**  
(Based on discussions finalized on June 1, 2025\)  
**I. Projected Commission (PC) System**  
A. Equation 1: Initial Projected Commission (PC) Value for a Single Logged PC KPI Event  
 \* Purpose: Determines the raw PC dollar amount a specific logged PC KPI initially projects.  
 \* Output Variable: Initial\_PC\_Generated  
 \* Inputs:  
   \* User\_Average\_Price\_Point (User-specific setting)  
   \* User\_Commission\_Rate (User-specific setting, use as decimal e.g., 0.025 for 2.5%)  
   \* PC\_Weight\_Percent (From Master KPI Definition for the specific KPI type, use as decimal e.g., 0.07 for 7.0%)  
 \* Formula:  
   Initial\_PC\_Generated \= User\_Average\_Price\_Point \* User\_Commission\_Rate \* PC\_Weight\_Percent  
B. PC Timeline Logic (Derived from TTC\_Definition for each PC KPI Type)  
 \* Purpose: To determine the timing for when a PC contribution appears on the graph and when its decay begins.  
 \* Input (from Master KPI Definition): TTC\_Definition (string, e.g., "X-Y days" or "Z days")  
 \* Outputs (for each PC KPI type):  
   \* Delay\_Before\_Payoff\_Starts (integer, number of days)  
   \* Hold\_Duration (integer, number of days)  
 \* Parsing Rules for TTC\_Definition:  
   \* If TTC\_Definition is a range pattern (e.g., "X – Y days"):  
     \* Delay\_Before\_Payoff\_Starts \= X (the first number in the range)  
     \* Hold\_Duration \= Y \- X (the difference between the second and first numbers)  
     \* Example: If TTC\_Definition \= "60–90 days", then Delay\_Before\_Payoff\_Starts \= 60 days, and Hold\_Duration \= 30 days.  
   \* If TTC\_Definition is a single number pattern (e.g., "Z days"):  
     \* Delay\_Before\_Payoff\_Starts \= 0 days  
     \* Hold\_Duration \= Z (the single number provided)  
     \* Example: If TTC\_Definition \= "30 days", then Delay\_Before\_Payoff\_Starts \= 0 days, and Hold\_Duration \= 30 days.  
 \* Derived Dates for each specific PC KPI Log Event:  
   \* Log\_Date: The actual or simulated timestamp when the KPI was logged.  
   \* Payoff\_Start\_Date\_On\_Graph \= Log\_Date \+ Delay\_Before\_Payoff\_Starts (days)  
   \* Decay\_Start\_Date \= Log\_Date \+ Delay\_Before\_Payoff\_Starts (days) \+ Hold\_Duration (days)  
C. Equation 2: Current Value of a Projected Commission (PC) During its Linear Decay Period  
 \* Purpose: Determines the remaining PC dollar amount of a single logged KPI event on a given Current\_Date that falls within its decay period.  
 \* Output Variable: Current\_Decayed\_PC\_Value  
 \* Inputs:  
   \* Initial\_PC\_Generated (from Equation I.A for this specific KPI log)  
   \* Total\_Decay\_Duration\_Days (Fixed at 180 days for standard PC KPIs as per Master KPI List)  
   \* Decay\_Start\_Date (Calculated for this specific KPI log as per PC Timeline Logic I.B)  
   \* Current\_Date (The date for which the value is being calculated)  
 \* Intermediate Calculation:  
   \* Days\_Into\_Decay \= Current\_Date \- Decay\_Start\_Date (expressed as an integer number of full days passed. If Current\_Date \= Decay\_Start\_Date, Days\_Into\_Decay \= 0).  
 \* Formula:  
   // This formula applies specifically when the KPI log is in its decay phase.  
// The overall system will determine if a KPI log is pre-delay, in delay, in hold, in decay, or fully decayed.  
IF Days\_Into\_Decay \< 0 THEN // Pre-decay  
    // Value is determined by whether it's in hold period or not yet active on graph  
    // This specific formula is for \*during\* decay. For simplicity here, assume it's called when relevant.  
    Current\_Decayed\_PC\_Value \= Initial\_PC\_Generated // Placeholder if called before decay starts but after Hold  
ELSE IF Days\_Into\_Decay \>= Total\_Decay\_Duration\_Days THEN  
    Current\_Decayed\_PC\_Value \= 0 // Fully decayed  
ELSE  
    Current\_Decayed\_PC\_Value \= max(0, Initial\_PC\_Generated \* (1 \- (Days\_Into\_Decay / Total\_Decay\_Duration\_Days)))  
END IF

   Developer Note: Ensure division is floating point. max(0, ...) is a safety. The value of a PC item before Decay\_Start\_Date is Initial\_PC\_Generated if Current\_Date is between Payoff\_Start\_Date\_On\_Graph and Decay\_Start\_Date, and 0 if Current\_Date is before Payoff\_Start\_Date\_On\_Graph.  
II. Forecast Confidence Score (0-100%)  
 \* Overall Purpose: To provide a score reflecting current confidence in the user's PC forecast.  
 \* Overall Formula:  
   Overall\_Confidence\_Score \= (Weight\_HA \* Score\_Historical\_Accuracy) \+ (Weight\_PH \* Score\_Pipeline\_Health) \+ (Weight\_IN \* Score\_Inactivity)  
   (Result likely rounded for display)  
 \* Component Weights:  
   \* Weight\_HA (Historical Accuracy): 35% (0.35)  
   \* Weight\_PH (Pipeline Health): 50% (0.50)  
   \* Weight\_IN (Inactivity): 15% (0.15)  
A. Component 1: Historical Accuracy Score (Score\_Historical\_Accuracy)  
 \* Scale: 0-100 points  
 \* Calculation Period: Rolling 12 months.  
 \* Inputs for Metric:  
   \* Total\_Actual\_GCI\_Last\_12\_Months: Sum of GCI from deals closed in the rolling 12-month window.  
   \* Total\_Projected\_PC\_Payoff\_Last\_12\_Months: Sum of Initial\_PC\_Generated for all PC KPI logs whose Payoff\_Start\_Date fell within the same rolling 12-month window.  
 \* Metric Formula:  
   Historical\_Accuracy\_Ratio \= Total\_Actual\_GCI\_Last\_12\_Months / Total\_Projected\_PC\_Payoff\_Last\_12\_Months  
 \* Scoring Logic:  
   \* If Total\_Projected\_PC\_Payoff\_Last\_12\_Months is $0 (or below a minimal threshold): Score\_Historical\_Accuracy \= 70  
   \* Else (based on Historical\_Accuracy\_Ratio):  
     \* Ratio \< 0.50: Score\_Historical\_Accuracy \= 20  
     \* 0.50 \<= Ratio \< 0.80: Score\_Historical\_Accuracy \= 45  
     \* 0.80 \<= Ratio \<= 1.20: Score\_Historical\_Accuracy \= 90  
     \* 1.20 \< Ratio \<= 1.75: Score\_Historical\_Accuracy \= 95  
     \* Ratio \> 1.75: Score\_Historical\_Accuracy \= 85  
B. Component 2: Pipeline Health Score (Score\_Pipeline\_Health)  
 \* Scale: 0-100 points  
 \* Focus: Next 45 days from the current date.  
 \* Inputs for Metric:  
   \* Potential\_GCI\_From\_Pipeline \= (Count\_Listings\_Pending \+ Count\_Buyers\_UC) \* User\_Avg\_GCI\_Per\_Deal (where User\_Avg\_GCI\_Per\_Deal \= User\_Average\_Price\_Point \* User\_Commission\_Rate)  
   \* Projected\_PC\_Next\_45\_Days \= Sum of PC from other non-pipeline-anchor prospecting activities expected to reach their Payoff\_Start\_Date\_On\_Graph or be in their Hold\_Duration or Decay phase within the next 45 days.  
 \* Metric Formula (if Projected\_PC\_Next\_45\_Days \> $0):  
   Pipeline\_Health\_Metric \= Potential\_GCI\_From\_Pipeline / Projected\_PC\_Next\_45\_Days  
 \* Scoring Logic:  
   \* If Projected\_PC\_Next\_45\_Days \= 0:  
     \* AND Potential\_GCI\_From\_Pipeline \= 0: Score\_Pipeline\_Health \= 10  
     \* AND Potential\_GCI\_From\_Pipeline \> 0: Score\_Pipeline\_Health \= 85  
   \* Else (based on Pipeline\_Health\_Metric):  
     \* Metric \< 0.5: Score\_Pipeline\_Health \= 15  
     \* 0.5 \<= Metric \< 0.8: Score\_Pipeline\_Health \= 40  
     \* 0.8 \<= Metric \<= 1.5: Score\_Pipeline\_Health \= 90  
     \* Metric \> 1.5: Score\_Pipeline\_Health \= 95  
C. Component 3: Inactivity Score (Score\_Inactivity)  
 \* Scale: 1-100 points  
 \* Input: Inactivity\_Flag\_Days (days since User.last\_activity\_timestamp).  
 \* Scoring Logic:  
   \* If Inactivity\_Flag\_Days \<= 14: Score\_Inactivity \= 100  
   \* Else (Inactivity\_Flag\_Days \> 14):  
     \* Days\_Past\_Threshold \= Inactivity\_Flag\_Days \- 14  
     \* Score\_Inactivity \= max(1, 100 \- (Days\_Past\_Threshold \* (100 / 60)))  
       (Linear decline over the 60 days following the 14-day grace period, to a minimum score of 1).  
III. Onboarding Interview \- Back-plotting Logic for Averaged KPIs  
 \* Purpose: To populate initial historical implied PC activity based on user-provided weekly averages for selected KPIs.  
 \* User Inputs (from Interview):  
   \* Selection starts with 3-5 recommended KPIs, with optional additional KPI selection subject to tier limits.  
   \* An average weekly activity count for each selected KPI.  
   \* Current GCI YTD, Last Year's Total GCI.  
   \* Current Deals Pending (Listings & Buyers) with relevant details for PC calculation.  
 \* Back-plotting Period for Averaged KPIs: Up to 365 days prior to the start of the "most recent week" (i.e., back-plotting ends 7 days before the current date).  
 \* Distribution of Weekly Averages:  
   \* For each week within the defined back-plotting period:  
     \* For each KPI the user provided an average for:  
       \* One single simulated KPI log entry is created.  
      \* This log entry represents the total average activity count for that KPI for that week.  
       \* The Log\_Date for this simulated entry is set to the Monday of that respective past week.  
 \* PC Calculation for Past Logs (Averaged KPIs):  
   \* Each simulated past log will have its Initial\_PC\_Generated calculated using Equation I.A.  
   \* The full PC Timeline Logic (from I.B) and Decay cycle (180 days, linear, using Equation I.C) will be applied to each simulated log, starting from its simulated Monday Log\_Date.  
 \* End of Interview Prompt: User will be prompted to manually log activities for the "most recent week."  
IV. Growth Points (GP) System Logic  
 \* Accumulation: Current\_User\_GP is the sum of GP\_Value from all GP-earning KPIs logged by the user.  
 \* Decay Trigger ("GP Inactivity"): Occurs if 30 consecutive days pass without the user logging any GP-earning KPI. (User last\_GP\_activity\_timestamp needs to be tracked).  
 \* Decay Process (once triggered by GP Inactivity):  
   \* The Current\_User\_GP decays linearly to 0 over a period of 60 days.  
   \* The daily amount of decay is (GP\_Value\_At\_Start\_Of\_Decay / 60).  
   \* Decay stops if a new GP-earning KPI is logged (at which point Current\_User\_GP would increase by the new points, and the 30-day inactivity timer for GP decay would reset).  
V. Vitality Points (VP) System Logic  
 \* Accumulation: Current\_User\_VP is the sum of VP\_Value from all VP-earning KPIs logged by the user.  
 \* Decay Trigger Condition ("VP Inactivity"): Current\_Time \- Last\_VP\_Log\_Time \> 12 hours (where Last\_VP\_Log\_Time is the timestamp of the last VP-earning KPI logged by the user).  
 \* Decay Application (managed by a daily system check for each user):  
   \* If the VP Inactivity condition ( \> 12 hours since last VP-earning log) is met at the time of the daily check:  
     \* Current\_User\_VP \= max(1, Current\_User\_VP \* 0.98)  
       (This applies a 2% decay to the current VP total, ensuring VP does not drop below 1 point. If the user logs a new VP-earning KPI, Current\_User\_VP increases, and the 12-hour inactivity timer resets.)  
VI. GP & VP Tier-Based Bump to Projected Commissions (PC)  
 \* Purpose: To apply a percentage increase to the user's displayed aggregated PC projection based on their current attained Tiers in Growth Points (GP) and Vitality Points (VP).  
 \* A. GP & VP Tier Definitions (Point Thresholds):  
   \* Tier 1 (GP or VP): Current\_User\_GP/VP is from 0 to 99 points  
   \* Tier 2 (GP or VP): Current\_User\_GP/VP is from 100 to 299 points  
   \* Tier 3 (GP or VP): Current\_User\_GP/VP is from 300 to 599 points  
   \* Tier 4 (GP or VP): Current\_User\_GP/VP is 600 points or more  
 \* B. Percentage Bump per Tier:  
   \* VP PC Bump % (VP\_Bump\_Percent):  
     \* VP Tier 1: 0%  
     \* VP Tier 2: 2.0%  
     \* VP Tier 3: 4.0%  
     \* VP Tier 4: 6.0%  
   \* GP PC Bump % (GP\_Bump\_Percent):  
     \* GP Tier 1: 0%  
     \* GP Tier 2: 2.5%  
     \* GP Tier 3: 5.0%  
     \* GP Tier 4: 7.5%  
 \* C. Calculation of Total PC Bump Percentage:  
   \* Total\_PC\_Bump\_Percentage \= VP\_Bump\_Percent \+ GP\_Bump\_Percent  
     \* (Ensure percentages are used as decimals for calculation, e.g., 7.0% is 0.07)  
 \* D. Application of the Bump:  
   \* The Total\_PC\_Bump\_Percentage is applied to the aggregated PC value that is to be displayed on the line graph for any future date.  
   \* Displayed\_Aggregated\_PC \= Raw\_Aggregated\_PC\_For\_Graph \* (1 \+ Total\_PC\_Bump\_Percentage)  
   \* This bump does not modify the stored Initial\_PC\_Generated for individual PC KPI log events. It's a display-time modification for the total projected PC line.  
 \* E. Tier Changes and Visuals:  
   \* As a user's Current\_User\_GP or Current\_User\_VP changes (due to earning points or decay), their respective Tier may change. This change in Tier will dynamically update the VP\_Bump\_Percent, GP\_Bump\_Percent, and consequently the Total\_PC\_Bump\_Percentage applied to the displayed PC graph. The backend will determine the current tier; the frontend will handle the visual representation (desaturation, wilting, rust as per project plan).  
VII. Adaptive Per-User KPI Weighting (Calibration Layer)  
 \* Purpose: Reduce projection bias caused by KPI selection/coverage differences by learning per-user KPI multipliers over time.  
 \* Effective weight for PC KPI logs:  
   \* Effective\_Weight(user,kpi) = Base\_PC\_Weight(kpi) \* User\_Multiplier(user,kpi)  
   \* Initial\_PC\_Generated uses Effective\_Weight in Equation I.A.  
 \* Multiplier bounds and safety:  
   \* User\_Multiplier is clamped to a conservative bounded range (default 0.5 to 1.5).  
 \* Onboarding initialization (one-time baseline):  
   \* For selected PC KPIs with historical weekly averages:  
     \* user\_share\_i = hist\_weekly\_i / sum(hist\_weekly\_selected)  
     \* base\_share\_i = base\_weight\_i / sum(base\_weight\_selected)  
     \* raw\_multiplier\_i = sqrt(user\_share\_i / max(base\_share\_i, epsilon))  
     \* multiplier\_i = clamp(raw\_multiplier\_i, min\_bound, max\_bound)  
   \* If onboarding history is sparse, default multipliers to 1.0.  
 \* Ongoing self-correction (triggered by Actual deal-close logs):  
   \* Compute predicted contribution overlap at close time from prior PC logs.  
   \* Attribution by KPI uses predicted-share weighting.  
   \* error\_ratio = Actual\_GCI / max(Predicted\_Window\_GCI, epsilon), clamped to conservative bounds.  
   \* Update step per KPI:  
     \* step = lr \* trust(sample\_size) \* (error\_ratio \- 1) \* attribution\_share\_kpi  
     \* multiplier\_new = clamp(multiplier\_old \* (1 + step), min\_bound, max\_bound)  
 \* Diagnostics and transparency:  
   \* Track rolling error metrics and sample size for calibration quality.  
   \* Confidence formula remains display-layer; calibration diagnostics are additive explainability metadata.  
