import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASH = shutil.which("bash")
if os.name == "nt" and Path("C:/Program Files/Git/bin/bash.exe").exists():
    BASH = "C:/Program Files/Git/bin/bash.exe"

@unittest.skipUnless(BASH, "Bash is required")
class ClusterVerification(unittest.TestCase):
    def verify(self, yarn_rows, missing=0):
        with tempfile.TemporaryDirectory() as temp:
            tools = {
                "hostname": "echo master-node",
                "jps": "printf '1 NameNode\\n2 DataNode\\n3 SecondaryNameNode\\n4 ResourceManager\\n5 NodeManager\\n'",
                "hdfs": """if [ "$1" = dfsadmin ]; then
printf 'Live datanodes (2):\\nMissing blocks: %s\\nBlocks with corrupt replicas: 0\\nLow redundancy blocks: 0\\n' """ + str(missing) + """
else
echo "The filesystem under path '/' is HEALTHY"
fi""",
                "yarn": "printf '%s\\n' '" + '\n'.join(row + ' host:8042 0' for row in yarn_rows.splitlines()) + "'",
            }
            for name, content in tools.items():
                file = Path(temp) / name
                file.write_text("#!/bin/sh\n" + content + "\n")
                file.chmod(0o755)
            tool_path = temp
            inherited_path = os.environ["PATH"]
            if os.name == "nt":
                tool_path = subprocess.check_output(
                    [BASH, "-lc", f'cygpath -u "{temp}"'], text=True
                ).strip()
                inherited_path = "/usr/bin:/bin"
            env = dict(
                os.environ,
                HADOOP_HOME=tool_path,
                JAVA_HOME=tool_path,
                PATH=tool_path + ":" + inherited_path,
                ODY_VERIFY_FIXTURE="1",
                ODY_VERIFY_HOST="master-node",
            )
            return subprocess.run(
                [BASH, str(ROOT / "ops/verify/cluster.sh")],
                env=env, capture_output=True, text=True, timeout=10,
            )

    def test_shutdown_history_is_ignored(self):
        result = self.verify("master-node:1 RUNNING\napp-node:2 RUNNING\napp-node:3 SHUTDOWN")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_duplicate_running_is_rejected(self):
        self.assertNotEqual(self.verify("master-node:1 RUNNING\napp-node:2 RUNNING\napp-node:3 RUNNING").returncode, 0)

    def test_missing_blocks_are_rejected(self):
        self.assertNotEqual(self.verify("master-node:1 RUNNING\napp-node:2 RUNNING", 1).returncode, 0)
