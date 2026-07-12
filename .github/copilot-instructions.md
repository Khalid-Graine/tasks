# Project Usage and Expectations

This project is a mobile-first React task tracker built with Vite, React Router, and Tailwind CSS.

Key project tools and behavior:
- `npm run dev -- --host` for local live preview while editing.
- React and React Router handle page routing for `/`, `/math`, and `/supplements`.
- Tailwind CSS is used for responsive styling and mobile layout.
- The header is fixed at the top of the screen, so page content should include top padding to avoid being hidden behind it.
- Data is stored in the browser and should update immediately when tasks or progress are changed.

Important user focus:
- This website is mainly used on a phone, so the interface must stay responsive and easy to use on small screens.
- The app should always keep data up to date when something changes.
- Most important: data must sync across all devices, so changes made on one device should be reflected on another.
- If possible, make sync fast and reliable for mobile users.

Implementation notes:
- Pay attention to local storage or remote sync behavior so data does not get lost.
- Keep the Math page and other routes viewable without the header covering the top content.
- Use safe area padding for phones and keep the user experience smooth on touch screens.
