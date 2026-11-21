# Contributing

For setup and checks, see [Development](DEVELOPMENT.md).

## Report a Problem

Check existing issues first, then
[report a problem](https://github.com/cmu-web/cmu-web-kilt-mcp/issues/new?template=bug_report.yml).
Include the tool, its arguments and the kit version.

## Submit a Pull Request

- Branch from `main` and open the pull request against `main`.
- Keep it to one concern.
- Explain the problem, the resulting behavior and how you checked the change.
- Run `npm run check` before submitting. The Publish Image workflow runs it
  again on the pull request.
- Component markup, installation steps and conventions come from the Web
  Kilt's releases. Change those in the [kit
  repository](https://github.com/cmu-web/cmu-web-kilt), not here.

## Code and Writing Style

- Follow the Web Kilt's [writing
  conventions](https://webkilt.andrew.cmu.edu/0/conventions.html) for prose,
  tool descriptions and examples: AP style, and Title Case for headings,
  buttons and labels.
- Use made-up content in examples and tests, and Andrew Carnegie (ac00) for a
  person.
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
  for commit subjects.

## CMU's Names and Marks

CMU's names, marks and artwork aren't covered by the license. Use them only
as the project already does.
