import { lintCommit, formatReport } from "@miscellaneous/commitlint";

const commitMsgFile = Deno.args[0];
if (!commitMsgFile) {
  console.error("No commit message file provided.");
  Deno.exit(1);
}

try {
  const commitMsg = await Deno.readTextFile(commitMsgFile);
  const trimmedMsg = commitMsg.trim();

  if (trimmedMsg.length > 200) {
    console.error(`Error: Commit message is too long (${trimmedMsg.length} > 200 characters)`);
    Deno.exit(1);
  }

  if (trimmedMsg.length === 0) {
    console.error("Error: Commit message is empty.");
    Deno.exit(1);
  }

  const report = lintCommit(trimmedMsg);

  if (!report.valid) {
    console.error("Error: Commit message does not follow conventional commits format.");
    console.error(formatReport(report));
    Deno.exit(1);
  }
} catch (error) {
  console.error("Error reading commit message file:", error);
  Deno.exit(1);
}
