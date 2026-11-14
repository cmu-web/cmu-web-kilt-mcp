# Carnegie Mellon Web Kilt MCP Server

**Give Your Agent the Kit's Own Docs**

An MCP server that helps coding agents build with the
[Carnegie Mellon Web Kilt](https://webkilt.andrew.cmu.edu/).
It supplies installation steps, component markup, framework notes and
writing conventions from the kit's releases, plus a check for common markup
mistakes.

**[Explore the Web Kilt](https://webkilt.andrew.cmu.edu/)** ·
[Connect Your Agent](#connect-your-agent) ·
[Work on the Server](DEVELOPMENT.md)

## Connect Your Agent

Add a remote MCP server in your agent's settings:

| Setting        | Value                                |
| -------------- | ------------------------------------ |
| Name           | `cmu-web-kilt`                       |
| Transport      | Streamable HTTP                      |
| URL            | `https://webkilt.andrew.cmu.edu/mcp` |
| Authentication | None                                 |

Then ask it to set up the Web Kilt for your project. The server provides a
`set-up-kit` prompt for clients that support MCP prompts.

For a server your agent starts locally over stdio, see
[Run It With an Agent](DEVELOPMENT.md#run-it-with-an-agent).

## Start With What You're Building

- **Set up a project:** `get_install` supplies the release's installation
  steps for your kind of site or app.
- **Build a page:** `search_components` and `get_component` find the
  components and return their markup, with optional framework guidance.
- **Review the result:** `get_conventions` supplies the writing and page
  conventions; `check_html` checks kit classes, hooks and page dependencies.

Each tool accepts a kit `version`. Use the version your project loads;
omitting it selects the newest release of any line, which is only for a
quick look. The major version is the CMU template line: 0.x is for the
current template. Releases from 0.3.0 onward are supported. The MCP server's own version is separate from the kit version.

The tools read public release data and check submitted HTML; they do not
edit your project. Your coding agent makes the changes. The markup check
supplements browser review and is not an accessibility audit.

## Help Improve the Server

[Report a problem or suggest a feature](https://github.com/cmu-web/cmu-web-kilt-mcp/issues).
Include the tool, arguments, kit version and unexpected result.
[Development](DEVELOPMENT.md) covers local setup, tests and the data flow;
[Deployment](DEPLOYMENT.md) covers hosting and releases.

## License

Copyright Carnegie Mellon University. The server code uses the
[BSD 3-Clause License](LICENSE). That license does not grant rights to
CMU's names, marks, artwork or web template.
