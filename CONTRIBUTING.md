# 🤝 Contributing Guidelines

Contributions, issues, and forks are welcome.

Since this project is small, we use a MAJOR.MINOR versioning system where the major version is bumped on breaking changes and the minor version is bumped on all other features and bug fixes.

The [Random Text Generator for Outlook](https://github.com/twocaretcat/rtg-for-outlook) extension is used to generate screenshots that don't contain any private data.

## Reporting Issues

Not a coder? See the [support resources](https://github.com/caret-collective/.github/blob/main/docs/SUPPORT.md) for information on how to:

- request features
- report bugs
- ask questions
- report security vulnerabilities

## Finding Issues to Work On

Issues with the `🚦 ready` label are ready to be worked on. If you comment on an issue, I can assign it to you.

Issues with the `🚦 needs triage` label generally need some more information before they can be worked on, but if you
**start a discussion** about it or leave a comment on the issue, I can likely get it ready for you.

If an issue is unclear or you have any questions about how a feature should be implemented, reach out before making any
changes so we can discuss the best way to do it.

## Ways to Contribute

### Translations

If you know another language and want to help out, please follow these steps:
1. [Create an issue](../../issues) with details about which language you are adding. Make sure your language is listed in the table [here](https://developer.chrome.com/docs/webstore/i18n/#choosing-locales-to-support). If not, your language is not supported unfortunately 😢
2. Make sure your language is not already in the [_locales](_locales) folder. If it is, we may have translations for your language already, but they might be out of date.
3. Download the [english messages file](_locales/en/messages.json) and translate each message into your language. The descriptions explain how each message is used in the extension, so these don't need to be translated.
4. Upload your translated messages file to the issue you created
5. Profit!

### Code

**Guidelines:**
- SCSS is used to make writing styles easier and more maintainable. Please take advantage of its features
- Variables are defined in [_vars.scss](css/_vars.scss) and should be used whenever possible instead of hardcoding values
- Any styles written should be specific enough to not affect unintended areas of the application, but not overly specific such that styles are broken every time Outlook releases an update (do not use Outlook's randomly generated class names)
- Styles should be as short as possible, and written in relation to other elements with hardcoded attributes. See [main.scss](css/main.scss) for examples

## License

By contributing to this project, you agree that your contributions will be licensed under the project license.
