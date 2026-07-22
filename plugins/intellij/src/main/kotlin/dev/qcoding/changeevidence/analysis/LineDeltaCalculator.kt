package dev.qcoding.changeevidence.analysis

/**
 * Calculates deterministic line statistics without an external diff process.
 *
 * A frequency-based comparison keeps runtime linear for very large generated
 * files. Reordered unchanged lines are treated as moves, which is preferable
 * to inflating a pre-commit risk score.
 */
object LineDeltaCalculator {
    fun calculate(beforeContent: String?, afterContent: String?): FileDelta {
        val beforeLines = lines(beforeContent)
        val afterLines = lines(afterContent)
        val remainingBefore = beforeLines.groupingBy { it }.eachCount().toMutableMap()
        val additions = ArrayList<AddedLine>()
        var matches = 0

        afterLines.forEachIndexed { index, line ->
            val remaining = remainingBefore[line] ?: 0
            if (remaining > 0) {
                remainingBefore[line] = remaining - 1
                matches++
            } else {
                additions += AddedLine(index + 1, line)
            }
        }

        return FileDelta(
            additions = additions.size,
            deletions = beforeLines.size - matches,
            addedLines = additions,
        )
    }

    private fun lines(content: String?): List<String> {
        if (content.isNullOrEmpty()) return emptyList()
        return content
            .replace("\r\n", "\n")
            .replace('\r', '\n')
            .split('\n')
            .let { if (it.lastOrNull().isNullOrEmpty()) it.dropLast(1) else it }
    }
}
