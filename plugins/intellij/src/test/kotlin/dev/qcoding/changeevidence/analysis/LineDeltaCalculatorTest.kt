package dev.qcoding.changeevidence.analysis

import org.junit.Assert.assertEquals
import org.junit.Test

class LineDeltaCalculatorTest {
    @Test
    fun `calculates added lines with their new line numbers`() {
        val delta = LineDeltaCalculator.calculate(
            beforeContent = "alpha\nbeta\n",
            afterContent = "alpha\ngamma\nbeta\ndelta\n",
        )

        assertEquals(2, delta.additions)
        assertEquals(0, delta.deletions)
        assertEquals(
            listOf(AddedLine(2, "gamma"), AddedLine(4, "delta")),
            delta.addedLines,
        )
    }

    @Test
    fun `does not inflate line count when lines are reordered`() {
        val delta = LineDeltaCalculator.calculate(
            beforeContent = "alpha\nbeta\ngamma",
            afterContent = "gamma\nalpha\nbeta",
        )

        assertEquals(0, delta.additions)
        assertEquals(0, delta.deletions)
    }

    @Test
    fun `handles duplicate lines deterministically`() {
        val delta = LineDeltaCalculator.calculate(
            beforeContent = "same\nsame\n",
            afterContent = "same\nsame\nsame\n",
        )

        assertEquals(1, delta.additions)
        assertEquals(0, delta.deletions)
        assertEquals(3, delta.addedLines.single().number)
    }
}
