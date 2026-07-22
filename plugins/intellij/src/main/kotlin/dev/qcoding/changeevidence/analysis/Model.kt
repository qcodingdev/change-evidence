package dev.qcoding.changeevidence.analysis

enum class ChangeStatus {
    ADDED,
    MODIFIED,
    DELETED,
    MOVED,
}

enum class RiskLevel(val rank: Int) {
    OK(0),
    LOW(1),
    MEDIUM(2),
    HIGH(3);

    companion object {
        fun highest(levels: Iterable<RiskLevel>): RiskLevel =
            levels.maxByOrNull { it.rank } ?: OK
    }
}

enum class FileCategory {
    PRODUCTION,
    TEST,
    CONFIG,
    DEPENDENCY,
    MIGRATION,
    CI,
    DOCUMENTATION,
    ASSET,
}

data class ChangedFile(
    val path: String,
    val status: ChangeStatus,
    val beforeContent: String?,
    val afterContent: String?,
    val contentAvailable: Boolean = true,
)

data class AddedLine(
    val number: Int,
    val text: String,
)

data class FileDelta(
    val additions: Int,
    val deletions: Int,
    val addedLines: List<AddedLine>,
) {
    val changedLines: Int
        get() = additions + deletions
}

data class RiskFinding(
    val ruleId: String,
    val level: RiskLevel,
    val messageKey: String,
    val messageArguments: List<Any>,
    val path: String? = null,
    val line: Int? = null,
)

data class AnalyzedFile(
    val path: String,
    val status: ChangeStatus,
    val category: FileCategory,
    val additions: Int,
    val deletions: Int,
    val level: RiskLevel,
    val findings: List<RiskFinding>,
)

data class RiskReport(
    val files: List<AnalyzedFile>,
    val findings: List<RiskFinding>,
    val overallLevel: RiskLevel,
    val totalAdditions: Int,
    val totalDeletions: Int,
) {
    companion object {
        val EMPTY = RiskReport(
            files = emptyList(),
            findings = emptyList(),
            overallLevel = RiskLevel.OK,
            totalAdditions = 0,
            totalDeletions = 0,
        )
    }
}
