import os, sys, subprocess

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
env = os.environ.copy()
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startsWith('#') if hasattr(line, 'startsWith') else (line and not line.startswith('#')):
                parts = line.split('=', 1)
                if len(parts) == 2:
                    k, v = parts[0].strip(), parts[1].strip().strip('"').strip("'")
                    env[k] = v

subprocess.run(["mvn", "spring-boot:run"], cwd=os.path.dirname(__file__), env=env)
