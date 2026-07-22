package dev.qcoding.changeevidence.analysis

import java.util.Locale

class RiskEngine(
    private val thresholds: Thresholds = Thresholds(),
) {
    data class Thresholds(
        val maxFiles: Int = 20,
        val maxTotalLines: Int = 500,
        val maxSingleFileLines: Int = 300,
        val highSingleFileLines: Int = 800,
    )

    fun analyze(input: Collection<ChangedFile>): RiskReport {
        val files = input
            .distinctBy { normalizePath(it.path) }
            .map { it.copy(path = normalizePath(it.path)) }
            .sortedBy { it.path.lowercase(Locale.ROOT) }
        val deltas = files.associateWith {
            LineDeltaCalculator.calculate(it.beforeContent, it.afterContent)
        }
        val categories = files.associateWith(::classify)
        val findings = ArrayList<RiskFinding>()

        files.forEach { file ->
            val category = categories.getValue(file)
            val delta = deltas.getValue(file)

            if (!file.contentAvailable) {
                findings += finding(
                    ruleId = "content.unavailable",
                    level = RiskLevel.LOW,
                    key = "risk.content.unavailable",
                    file = file,
                )
            }
            if (isHighRiskPath(file.path)) {
                findings += finding(
                    ruleId = "high.path",
                    level = RiskLevel.HIGH,
                    key = "risk.high.path",
                    file = file,
                )
            }
            when (category) {
                FileCategory.DEPENDENCY -> findings += finding(
                    "dependency",
                    RiskLevel.MEDIUM,
                    "risk.dependency",
                    file,
                )
                FileCategory.CONFIG -> findings += finding(
                    "config",
                    RiskLevel.MEDIUM,
                    "risk.config",
                    file,
                )
                FileCategory.MIGRATION -> findings += finding(
                    "migration",
                    RiskLevel.HIGH,
                    "risk.migration",
                    file,
                )
                FileCategory.CI -> findings += finding(
                    "ci",
                    RiskLevel.MEDIUM,
                    "risk.ci",
                    file,
                )
                else -> Unit
            }
            if (category == FileCategory.TEST && file.status == ChangeStatus.DELETED) {
                findings += finding(
                    "tests.deleted",
                    RiskLevel.HIGH,
                    "risk.tests.deleted",
                    file,
                )
            }

            findings += sensitiveAssignmentFindings(file, delta)
            findings += publicApiFindings(file, category, delta)

            if (delta.changedLines > thresholds.maxSingleFileLines) {
                findings += RiskFinding(
                    ruleId = "size.single",
                    level = if (delta.changedLines > thresholds.highSingleFileLines) {
                        RiskLevel.HIGH
                    } else {
                        RiskLevel.MEDIUM
                    },
                    messageKey = "risk.size.single",
                    messageArguments = listOf(
                        file.path,
                        delta.changedLines,
                        thresholds.maxSingleFileLines,
                    ),
                    path = file.path,
                )
            }
        }

        val productionFiles = files.filter { categories[it] == FileCategory.PRODUCTION }
        val changedTests = files.any { categories[it] == FileCategory.TEST }
        if (productionFiles.isNotEmpty() && !changedTests) {
            productionFiles.forEach { file ->
                findings += finding(
                    "tests.missing",
                    RiskLevel.MEDIUM,
                    "risk.tests.missing",
                    file,
                )
            }
        }

        if (files.size > thresholds.maxFiles) {
            findings += RiskFinding(
                ruleId = "size.files",
                level = RiskLevel.MEDIUM,
                messageKey = "risk.size.files",
                messageArguments = listOf(files.size, thresholds.maxFiles),
            )
        }

        val totalAdditions = deltas.values.sumOf { it.additions }
        val totalDeletions = deltas.values.sumOf { it.deletions }
        val totalLines = totalAdditions + totalDeletions
        if (totalLines > thresholds.maxTotalLines) {
            findings += RiskFinding(
                ruleId = "size.total",
                level = if (totalLines > thresholds.maxTotalLines * 3) {
                    RiskLevel.HIGH
                } else {
                    RiskLevel.MEDIUM
                },
                messageKey = "risk.size.total",
                messageArguments = listOf(totalLines, thresholds.maxTotalLines),
            )
        }

        val stableFindings = findings
            .distinctBy { listOf(it.ruleId, it.path, it.line) }
            .sortedWith(
                compareByDescending<RiskFinding> { it.level.rank }
                    .thenBy { it.path ?: "" }
                    .thenBy { it.line ?: 0 }
                    .thenBy { it.ruleId },
            )
        val findingsByPath = stableFindings
            .filter { it.path != null }
            .groupBy { it.path }
        val analyzedFiles = files.map { file ->
            val fileFindings = findingsByPath[file.path].orEmpty()
            val delta = deltas.getValue(file)
            AnalyzedFile(
                path = file.path,
                status = file.status,
                category = categories.getValue(file),
                additions = delta.additions,
                deletions = delta.deletions,
                level = RiskLevel.highest(fileFindings.map { it.level }),
                findings = fileFindings,
            )
        }

        return RiskReport(
            files = analyzedFiles,
            findings = stableFindings,
            overallLevel = RiskLevel.highest(stableFindings.map { it.level }),
            totalAdditions = totalAdditions,
            totalDeletions = totalDeletions,
        )
    }

    internal fun classify(file: ChangedFile): FileCategory {
        val path = file.path.lowercase(Locale.ROOT)
        val name = path.substringAfterLast('/')
        val extension = name.substringAfterLast('.', "")

        return when {
            isCiPath(path, name) -> FileCategory.CI
            isMigrationPath(path, name) -> FileCategory.MIGRATION
            isTestPath(path, name) -> FileCategory.TEST
            isDependencyPath(path, name) -> FileCategory.DEPENDENCY
            isConfigPath(path, name, extension) -> FileCategory.CONFIG
            isDocumentationPath(path, name, extension) -> FileCategory.DOCUMENTATION
            extension in ASSET_EXTENSIONS -> FileCategory.ASSET
            else -> FileCategory.PRODUCTION
        }
    }

    private fun sensitiveAssignmentFindings(
        file: ChangedFile,
        delta: FileDelta,
    ): List<RiskFinding> {
        if (!file.contentAvailable) return emptyList()
        val findings = ArrayList<RiskFinding>()

        delta.addedLines.forEach { line ->
            val match = SENSITIVE_ASSIGNMENT.find(line.text) ?: return@forEach
            val key = match.groupValues[1]
            val rawValue = match.groupValues[2].trim()
            if (isSafeReference(rawValue)) return@forEach

            findings += RiskFinding(
                ruleId = "sensitive.assignment",
                level = RiskLevel.HIGH,
                messageKey = "risk.sensitive",
                messageArguments = listOf(file.path, key),
                path = file.path,
                line = line.number,
            )
        }
        return findings
    }

    private fun publicApiFindings(
        file: ChangedFile,
        category: FileCategory,
        delta: FileDelta,
    ): List<RiskFinding> {
        if (!file.contentAvailable || category != FileCategory.PRODUCTION) return emptyList()
        val path = file.path.lowercase(Locale.ROOT)
        val apiPath = path.contains("/api/") ||
            path.contains("/routes/") ||
            path.endsWith(".api.ts") ||
            path.endsWith("controller.java") ||
            path.endsWith("controller.kt")

        val match = delta.addedLines.firstOrNull { line ->
            PUBLIC_API_PATTERNS.any { it.containsMatchIn(line.text) }
        } ?: if (apiPath) {
            delta.addedLines.firstOrNull()
        } else {
            null
        } ?: return emptyList()

        return listOf(
            RiskFinding(
                ruleId = "public.api",
                level = RiskLevel.MEDIUM,
                messageKey = "risk.public.api",
                messageArguments = listOf(file.path),
                path = file.path,
                line = match.number,
            ),
        )
    }

    private fun isSafeReference(rawValue: String): Boolean {
        val value = rawValue
            .substringBefore(" //")
            .substringBefore(" #")
            .trim()
            .trimEnd(',', ';')
            .trim()
            .removeSurrounding("\"")
            .removeSurrounding("'")
            .trim()
        if (value.isEmpty()) return true

        val lower = value.lowercase(Locale.ROOT)
        return value.startsWith("$") ||
            value.startsWith("<") ||
            lower.startsWith("process.env") ||
            lower.contains("system.getenv") ||
            lower.contains("getenv(") ||
            lower.contains("config(") ||
            lower in SAFE_PLACEHOLDERS ||
            lower.matches(Regex("""x{3,}|[*]{3,}|[.]{3,}"""))
    }

    private fun finding(
        ruleId: String,
        level: RiskLevel,
        key: String,
        file: ChangedFile,
    ) = RiskFinding(
        ruleId = ruleId,
        level = level,
        messageKey = key,
        messageArguments = listOf(file.path),
        path = file.path,
    )

    private fun isHighRiskPath(path: String): Boolean {
        val lower = path.lowercase(Locale.ROOT)
        val name = lower.substringAfterLast('/')
        return name == ".env" ||
            name.startsWith(".env.") ||
            name.endsWith(".pem") ||
            name.endsWith(".key") ||
            name in setOf("credentials", "credentials.json", "secrets.yml", "secrets.yaml") ||
            HIGH_RISK_SEGMENT.containsMatchIn(lower)
    }

    private fun isCiPath(path: String, name: String): Boolean =
        path.startsWith(".github/workflows/") ||
            path.contains("/.github/workflows/") ||
            path.startsWith(".circleci/") ||
            name == ".gitlab-ci.yml" ||
            name == ".gitlab-ci.yaml" ||
            name == "jenkinsfile" ||
            name == "azure-pipelines.yml"

    private fun isMigrationPath(path: String, name: String): Boolean =
        path.contains("/migration/") ||
            path.contains("/migrations/") ||
            path.startsWith("migration/") ||
            path.startsWith("migrations/") ||
            path.contains("/db/migrate/") ||
            name.matches(Regex("""v\d+(?:[._]\d+)*__.+\.sql"""))

    private fun isTestPath(path: String, name: String): Boolean =
        path.contains("/test/") ||
            path.contains("/tests/") ||
            path.contains("/__tests__/") ||
            path.startsWith("test/") ||
            path.startsWith("tests/") ||
            name.matches(Regex(""".+\.(test|spec)\.[a-z0-9]+""")) ||
            name.endsWith("test.java") ||
            name.endsWith("tests.java") ||
            name.endsWith("test.kt") ||
            name.endsWith("tests.kt")

    private fun isDependencyPath(path: String, name: String): Boolean =
        name in DEPENDENCY_FILES ||
            name.endsWith(".lock") ||
            name.endsWith("-lock.json") ||
            path.endsWith("/gradle/libs.versions.toml")

    private fun isConfigPath(path: String, name: String, extension: String): Boolean =
        name == "dockerfile" ||
            name.startsWith("dockerfile.") ||
            name.startsWith(".env") ||
            extension in CONFIG_EXTENSIONS ||
            name in CONFIG_FILES ||
            path.startsWith(".idea/runconfigurations/")

    private fun isDocumentationPath(path: String, name: String, extension: String): Boolean =
        extension in DOCUMENTATION_EXTENSIONS ||
            name == "license" ||
            name == "readme" ||
            name == "changelog" ||
            path.startsWith("docs/") ||
            path.contains("/docs/")

    companion object {
        private val DEPENDENCY_FILES = setOf(
            "package.json",
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
            "pom.xml",
            "build.gradle",
            "build.gradle.kts",
            "settings.gradle",
            "settings.gradle.kts",
            "gradle.properties",
            "go.mod",
            "go.sum",
            "cargo.toml",
            "cargo.lock",
            "requirements.txt",
            "pyproject.toml",
            "poetry.lock",
            "gemfile",
            "gemfile.lock",
        )
        private val CONFIG_FILES = setOf(
            "tsconfig.json",
            ".editorconfig",
            ".eslintrc",
            ".prettierrc",
            "application.json",
            "appsettings.json",
        )
        private val CONFIG_EXTENSIONS = setOf(
            "yml",
            "yaml",
            "toml",
            "ini",
            "conf",
            "properties",
        )
        private val DOCUMENTATION_EXTENSIONS = setOf("md", "markdown", "rst", "adoc", "txt")
        private val ASSET_EXTENSIONS = setOf(
            "css",
            "scss",
            "sass",
            "less",
            "svg",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "ico",
            "woff",
            "woff2",
            "ttf",
        )
        private val HIGH_RISK_SEGMENT = Regex(
            """(^|/)(auth|authentication|authorization|security|permissions?|payments?|billing|secrets?|credentials?)(/|$)""",
        )
        private val SENSITIVE_ASSIGNMENT = Regex(
            """(?i)\b(password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*([^,\n}]+)""",
        )
        private val SAFE_PLACEHOLDERS = setOf(
            "example",
            "sample",
            "dummy",
            "test",
            "changeme",
            "change-me",
            "your-value",
            "your-secret",
            "redacted",
            "[redacted]",
            "null",
            "none",
        )
        private val PUBLIC_API_PATTERNS = listOf(
            Regex("""\bpublic\s+(?:static\s+)?[\w<>,.?\[\]\s]+\s+\w+\s*\("""),
            Regex("""@(Request|Get|Post|Put|Delete|Patch)Mapping\b"""),
            Regex("""\bexport\s+(?:default\s+)?(?:async\s+)?(function|class|interface|const|type)\b"""),
            Regex("""^\s*(?:public\s+)?fun\s+\w+\s*\("""),
            Regex("""^\s*@(?:app|router)\.(?:get|post|put|delete|patch)\s*\("""),
        )

        private fun normalizePath(path: String): String =
            path.replace('\\', '/').removePrefix("./")
    }
}
