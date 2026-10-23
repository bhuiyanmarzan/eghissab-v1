# Application languages

English and Bangla are bundled with i18next. The browser detector checks the saved i18nextLng preference before the browser language and falls back to English. Language controls are available in the shared dashboard header and public pages.

Add the English UI phrase and its Bangla translation to bn.json. English phrases serve as flat resource keys; punctuation is supported. Use translateString for string props and translateNode for rendered labels, and subscribe with useTranslation in the component so changes render immediately. Dynamic phrases use i18next interpolation in lib/localization.ts.

Keep routes, enum values, customer names, email addresses, identifiers and user-authored messages unchanged. Localize displayed dates and numeric totals with the Intl helpers. Preserve option values independently of translated labels. The locally bundled Noto Sans Bengali fonts provide Bengali glyphs with every theme font.
