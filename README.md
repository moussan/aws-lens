<div align="center">

# AWS Lens

A desktop operator workspace with first-class Terraform infrastructure management, built on Electron, React, and TypeScript. AWS Lens brings Terraform projects, drift detection, governance checks, variable management, and plan visualization into a single desktop experience alongside 25+ AWS service consoles.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-35-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AWS SDK](https://img.shields.io/badge/AWS_SDK-v3-FF9900.svg?logo=amazon-aws&logoColor=white)](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-required-F69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)

<img src="images/terraform-main.png" alt="AWS Lens Terraform Workspace" width="100%" />

</div>

---

## Terraform as a First-Class Service

AWS Lens treats Terraform as a core operator workflow, not an afterthought. The Terraform workspace provides a full lifecycle management surface: from project discovery and variable configuration through plan visualization, apply execution, drift reconciliation, and governance enforcement.

### Project Discovery and Command Execution

- Discover and manage local Terraform project folders from a visual project browser
- Run `init`, `plan`, `apply`, `destroy`, `import`, `state`, `force-unlock`, and `version` with real-time streaming output
- Create, switch, and delete Terraform workspaces
- Track long-running apply/destroy operations, including graceful handling during app shutdown
- Git metadata integration showing repository, branch, commit, dirty status, and changed files per project

### Variable Sets and Secret Inputs

- Create named variable sets with a base layer plus environment-specific overlays
- Edit variables inline with validation, sensitive value masking, and type-aware inputs
- Pull runtime secrets from AWS Secrets Manager and SSM Parameter Store directly into variable configuration
- Load variables from `.tfvars` files or JSON configuration
- Detect missing required variables before plan or apply

### Plan Visualization and Analysis

- Generate plans with multiple execution modes: standard, refresh-only, targeted, and replace
- Save and compare plan artifacts with grouped change summaries by module, action type, and resource
- Heuristic detection of destructive changes, replacements, and delete-heavy operations
- Visual plan diff with create, update, and delete indicators

### Drift Reconciliation

Drift detection compares Terraform state against live AWS resources across a wide range of resource types:

- **Compute**: EC2 instances, Lambda functions, EKS clusters, ECS (via Terraform state)
- **Networking**: VPCs, subnets, security groups, route tables, internet gateways, NAT gateways, transit gateways, network interfaces
- **Storage**: S3 buckets, ECR repositories
- **Database**: RDS instances and clusters

Each resource receives a status classification (`in_sync`, `drifted`, `missing_in_aws`, `unmanaged_in_aws`, `unsupported`) and an assessment level (`verified`, `inferred`, `unsupported`). Drift results include attribute-level diffs, tag drift, and heuristic findings. Snapshot history with trend tracking shows whether drift is improving or worsening over time.

From any drifted resource, shortcuts open the AWS Console or run `terraform state show` directly.

### Governance and Safety Checks

- Detects availability of `terraform validate`, `tflint`, `tfsec`, and `checkov`
- Runs governance tools with configurable requirements (blocking vs. optional)
- Categorizes findings by severity: critical, high, medium, low, info
- Produces governance reports with check status, findings, and execution times
- Pre-apply blocking prevents `terraform apply` when critical checks fail

### State Management and Backups

- View raw Terraform state JSON and parsed resource inventory
- Browse managed and data resources with type, address, attributes, and tags
- Automated state backups (up to 20 per workspace) with size tracking
- State lock visibility showing lock ID, who holds it, and lock operation
- State operations history for audit and troubleshooting

### Infrastructure Diagram

![AWS Lens Terraform Visualization](images/terraform-visualization.png)

Visual graph of Terraform-managed resources and their dependency relationships, generated from the current state.

### Run History

- Timestamped records of every Terraform command executed
- Command arguments (with redacted sensitive values), exit codes, and duration
- Filterable history with bulk cleanup

---

## AWS Operator Workspace

Beyond Terraform, AWS Lens provides a full operator workspace for common AWS services. It reads local AWS profiles, lets you activate a profile and region, and keeps that context synchronized across the UI and the embedded terminal.

### Profile and Region Context

- Reads AWS profiles from `~/.aws/config` and `~/.aws/credentials`
- Searchable profile catalog with import and creation support
- Region-aware service navigation with context kept in sync across all screens

### Session Hub

Cross-account session management for assume-role workflows:

- Save assume-role targets locally
- Assume roles through STS on demand with session tracking
- Activate assumed sessions as the active app context
- Temporary credentials held in memory only, never written to AWS config files

### Compliance Center

Aggregates security findings for the active profile and region, grouped by severity and category with guided remediation paths.

### Service Consoles

Dedicated consoles for 25+ AWS services with inventory views and targeted operator actions:

| Category | Services |
|---|---|
| Compute | EC2, Lambda, ECS, EKS, Auto Scaling |
| Storage | S3, ECR |
| Database | RDS |
| Networking | VPC, Load Balancers, Route 53, Security Groups |
| Management | CloudFormation, CloudTrail, CloudWatch |
| Security | IAM, Identity Center, KMS, WAF, ACM |
| Messaging | SNS, SQS |
| Other | Secrets Manager, Key Pairs, STS |

### Observability and Resilience Lab (Beta)

Operator-assistant surface for EKS clusters, ECS services, and Terraform workspaces. Provides posture analysis, telemetry gap detection, and resilience recommendations. Generates copyable artifacts: OTel YAML, awslogs snippets, Terraform snippets, and FIS template JSON.

### Embedded Terminal

- Backed by `node-pty` and `xterm`
- Shares active AWS context with the rest of the application
- Supports follow-up commands triggered from service screens
- Toggled from the footer as a persistent bottom panel

---

## Architecture

```text
.
|-- src/
|   |-- main/
|   |   |-- terraform.ts             # Terraform command orchestration
|   |   |-- terraformDrift.ts        # Drift detection against live AWS
|   |   |-- terraformGovernance.ts   # Governance tool runners
|   |   |-- terraformHistoryStore.ts # Run history persistence
|   |   |-- main.ts                  # Electron lifecycle, graceful shutdown
|   |   |-- awsIpc.ts               # AWS IPC handlers
|   |   |-- terminalIpc.ts          # PTY and terminal bridge
|   |   `-- aws/                    # 30+ AWS service client modules
|   |-- preload/
|   |   `-- index.ts                # Secure renderer-to-main bridge
|   `-- renderer/src/
|       |-- TerraformConsole.tsx     # Terraform UI workspace
|       |-- terraformApi.ts          # IPC bridge to Terraform backend
|       |-- terraform.css            # Terraform workspace styling
|       |-- App.tsx                  # App shell, navigation, routing
|       `-- *Console.tsx            # Service-specific consoles
|-- electron-builder.yml
|-- electron.vite.config.ts
|-- package.json
`-- tsconfig.json
```

### Local State

AWS Lens relies on your local workstation state rather than a hosted backend.

Reads from:
- `~/.aws/config`
- `~/.aws/credentials`

Stores app data under Electron `userData`:
- `terraform-workspace-state.json` -- project list, workspace selections, variable sets
- `terraform-state-backups/` -- automated state backup snapshots
- `session-hub.json` -- saved assume-role targets

Terraform artifacts stored per project:
- `.terraform-workspace.auto.tfvars.json` -- managed variable inputs
- `.terraform-workspace.tfplan` / `.tfplan.json` / `.tfplan.meta.json` -- plan artifacts
- `.terraform-workspace.state.json` -- cached state

---

## Prerequisites

- Node.js 20+
- `pnpm`
- Local AWS credentials for the profiles you want to use
- Terraform CLI (required for Terraform workspace features)

Optional:
- `tflint`, `tfsec`, `checkov` for governance checks
- AWS CLI for terminal-based verification
- `kubectl` for EKS-related workflows
- `docker` for ECR-related workflows

## Development

```sh
pnpm install      # install dependencies
pnpm dev          # run in development mode
pnpm typecheck    # type-check the project
pnpm build        # build production bundles (output: out/)
pnpm preview      # preview the built app
```

## Packaging

```sh
pnpm dist          # create desktop packages
pnpm dist:win      # Windows (NSIS)
pnpm dist:mac      # macOS (DMG, ZIP)
pnpm dist:linux    # Linux (deb, AppImage)
```

Packaged artifacts are written to `release/`. `node-pty` is unpacked from ASAR for packaged builds.

## Notes for Contributors

- Renderer code should use the preload bridge rather than direct Node access
- AWS-facing actions live in the Electron main process
- Temporary assumed-role credentials are not persisted to AWS config files
- Terraform support is local-workspace oriented, not remote-service oriented
- The app blocks accidental shutdown while Terraform apply/destroy is active

Additional project guidance lives in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).
