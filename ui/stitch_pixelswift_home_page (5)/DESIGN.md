# Lumina Velocity Design System

### 1. Overview & Creative North Star
**Creative North Star: "The Digital Kineticist"**
Lumina Velocity is a design system built for speed, transparency, and high-performance utility. It moves away from the static, boxy constraints of traditional utility apps and embraces an editorial layout characterized by airy whitespace and fluid transitions. The system prioritizes "clarity over decoration," using sharp typography and a vibrant primary blue to guide the eye through complex workflows with zero friction.

### 2. Colors
The palette is anchored by a deep "Electric Blue" primary, supported by a sophisticated range of cool slates.
- **Primary Roles:** Used for high-priority actions, branding, and active states.
- **The "No-Line" Rule:** Sectioning is achieved through shifts in background tone (e.g., transitioning from `surface` to `surface_container_low`) rather than hard 1px borders. If a boundary is required, use a 1px `outline_variant` at 50% opacity.
- **Surface Hierarchy:** 
    - Base layers use `surface` (#ffffff).
    - Section backgrounds use `surface_container_low` (#f8fafc).
    - Interactive card elements use `surface_container` (#f1f5f9).
- **The Glass & Gradient Rule:** Navigation headers must utilize a `backdrop-blur` of 12px combined with a 80% alpha transparency of the background color to maintain context during scroll. Hero sections should feature soft, large-scale radial gradients (e.g., Pink to Lavender) at 20% opacity to add depth without distracting from the data.

### 3. Typography
The system utilizes **Inter** exclusively to leverage its mathematical precision and high legibility at small sizes.
- **Display (3.75rem / 60px):** Black weight (900), tight tracking (-0.05em). Used for brand impact.
- **Headline (2.25rem / 36px):** Bold weight (700). Used for major section starts.
- **Title (1.25rem / 20px):** Bold weight (700). Used for card headings.
- **Body (1rem / 16px):** Regular weight (400). Standard for descriptions.
- **Label (0.875rem / 14px):** Medium weight (500). Used for navigation and utility links.
- **Rhythm:** The scale follows a tight 4px baseline grid, ensuring that line heights are always 1.5x the font size for body and 1.2x for headlines.

### 4. Elevation & Depth
Depth is communicated through "Tonal Stacking" rather than heavy drop shadows.
- **The Layering Principle:** Higher-level interactive components (like cards) should physically sit "above" the surface by shifting from `surface` to `surface_container`.
- **Ambient Shadows:** Only use `shadow-sm` (0 1px 2px 0 rgb(0 0 0 / 0.05)) for static cards. For hover states, transition to an "Elevated" state with a -4px Y-axis transform and a diffused 20px blur shadow.
- **Glassmorphism:** Apply a `backdrop-filter: blur(8px)` to all floating menus and sticky headers to create a sense of vertical layering.

### 5. Components
- **Buttons:** Primary buttons are solid `primary` with `on_primary` text and a subtle 105% scale transform on hover. Secondary buttons use a `surface` background with a 1px `outline` and `primary` text.
- **Cards:** Defined by `rounded-xl` (16px) corners and a `surface_container_low` background. On hover, they should transition to a white background with an expanded shadow.
- **Action Icons:** Encapsulate in `rounded-lg` (8px) containers. When used within a card, the icon container should change from a light tint of the primary color to the solid primary color on parent hover.
- **Inputs:** High-contrast borders using `outline` only on focus. The default state is a subtle `surface_container_high` fill.

### 6. Do's and Don'ts
- **Do:** Use generous padding (at least 32px) around major content blocks to emphasize the "Editorial" feel.
- **Do:** Use motion to explain hierarchy (e.g., cards sliding up slightly when appearing).
- **Don't:** Use pure black (#000000) for text; always use `on_surface` (#0f172a) to maintain a premium feel.
- **Don't:** Use multiple nested borders. If a card is inside a section, the section should be a color-fill and the card should be white with a shadow.