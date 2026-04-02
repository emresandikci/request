const MAIN_BRANCH_NAME = "main";

const isMainBranch =
  process.env.GITHUB_REF_NAME === MAIN_BRANCH_NAME ||
  process.env.GITHUB_REF === `refs/heads/${MAIN_BRANCH_NAME}`;

const changeLogPlugin = isMainBranch
  ? [
      [
        "@semantic-release/changelog",
        {
          changelogFile: "CHANGELOG.md",
        },
      ],
    ]
  : [];

const gitAssets = isMainBranch
  ? ["package.json", "../../pnpm-lock.yaml", "CHANGELOG.md"]
  : ["package.json", "../../pnpm-lock.yaml"];

module.exports = {
  branches: ["main", { name: "staging", prerelease: "staging" }],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "angular",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "docs", release: "patch" },
          { type: "style", release: false },
          { type: "refactor", release: "patch" },
          { type: "perf", release: false },
          { type: "test", release: false },
          { type: "chore", release: false },
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
    ],
    ...changeLogPlugin,
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
      },
    ],
    // ["@semantic-release/github"],
    [
      "@semantic-release/git",
      {
        assets: gitAssets,
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
