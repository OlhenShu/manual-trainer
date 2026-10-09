# UI Design System

## Component Library

- **Components:** shadcn/ui (current major version) on top of Tailwind CSS with CSS-first configuration.
- Components are added to `apps/web/src/components/ui` and may be edited locally — they are owned by the project, not the library.
- **Forms:** React Hook Form with the Zod resolver. Schemas come from `packages/shared`; never define duplicate validation rules in the frontend. Dynamic lists of fields (e.g. test-case steps) use React Hook Form field arrays.
- **Icons:** lucide-react.

## Design Tokens

- All colours, border radii, and spacing values come from theme tokens defined in CSS. No hard-coded hex values inside components.
- Token structure: neutral base palette plus one primary accent colour.
- Semantic colour tokens for review results — used consistently across the app:

| Token | Meaning |
|-------|---------|
| `success` | Criterion passed |
| `warning` | Partially passed |
| `danger` | Failed |

- Semantic colours are never the sole carrier of meaning. Always pair them with text or an icon.
- **Light theme only for MVP.** Tokens are structured so a dark theme can be added later without changing component code.
- **Font:** a sans-serif with full Cyrillic support, loaded with a system font fallback.

## Layout

- Desktop-first. All pages must remain usable at 360 px wide.
- **Authenticated layout** (shared by all protected pages): top bar containing the app name, main navigation, the current user's email, and the logout control. Admin pages add admin-specific navigation to the top bar.
- **Content width:** reading-heavy pages constrain content width. Task-solving pages may use full width and display a two-column layout on wide screens that stacks vertically on narrow screens.

## Forms and Interactive States

- Every field has a visible label. Placeholders are supplementary only — they never replace labels.
- **Validation errors:** field-level errors appear directly below the field; form-level API errors appear in an alert above the form.
- Error messages are shown after the first submit attempt, then update in real time as the user types.
- Submit buttons display a loading indicator and are disabled while a request is in flight.
- Every page that fetches data must have explicit **loading**, **empty**, and **error** states.

## Accessibility

- Full keyboard navigation with a visible focus indicator on all interactive elements.
- Text contrast meets WCAG AA.
- Error messages are programmatically linked to their fields (e.g. `aria-describedby`) so screen readers announce them.

## Copy

- All UI text is referenced by translation keys via react-i18next — never hard-coded in components.
- The only locale for MVP is `uk` (Ukrainian). Translation resources live in `apps/web/src/locales/uk/` as JSON files split into namespaces:
  - `common.json` — shared labels, buttons, navigation
  - `auth.json` — registration, login, logout copy
  - `errors.json` — all `ERROR_CODE` values and `VALIDATION_KEY` values
- Plurals use i18next plural rules; Ukrainian has `one`, `few`, and `many` forms.
- Dates and numbers are formatted via the `Intl` API with the current locale.
- No language switcher, no other locales, no browser language detection in MVP.
- Tone: neutral and supportive. Address the user with **"ви"**. Feedback on mistakes should explain what to improve — never use judgemental wording.

## Open Questions

- Which specific sans-serif font with Cyrillic support will be used (e.g. Inter, Nunito, Roboto)?
- What is the primary accent colour and the full neutral palette?
- Are there specific breakpoints defined for the two-column / stacked layout on task-solving pages?
- Is there a defined maximum content width for reading-heavy pages?