package dev.qcoding.changeevidence.analysis

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RiskEngineTest {
    private val engine = RiskEngine()

    @Test
    fun `detects high risk path and literal sensitive assignment without exposing value`() {
        val report = engine.analyze(
            listOf(
                changed(
                    path = "src/auth/session.ts",
                    after = """
                        export function login() {
                          const api_key = "real-looking-secret-value"
                        }
                    """.trimIndent(),
                ),
            ),
        )

        assertEquals(RiskLevel.HIGH, report.overallLevel)
        assertTrue(report.findings.any { it.ruleId == "high.path" })
        val sensitive = report.findings.single { it.ruleId == "sensitive.assignment" }
        assertEquals(2, sensitive.line)
        assertFalse(sensitive.messageArguments.joinToString().contains("real-looking-secret-value"))
    }

    @Test
    fun `ignores environment references and accepts a changed test`() {
        val report = engine.analyze(
            listOf(
                changed(
                    path = "src/service.ts",
                    after = "const token = process.env.ACCESS_TOKEN",
                ),
                changed(
                    path = "test/service.test.ts",
                    after = "it('works', () => expect(true).toBe(true))",
                ),
            ),
        )

        assertFalse(report.findings.any { it.ruleId == "sensitive.assignment" })
        assertFalse(report.findings.any { it.ruleId == "tests.missing" })
    }

    @Test
    fun `flags production changes when no tests change`() {
        val report = engine.analyze(
            listOf(changed("src/Service.kt", after = "class Service")),
        )

        assertTrue(report.findings.any { it.ruleId == "tests.missing" })
        assertEquals(RiskLevel.MEDIUM, report.overallLevel)
    }

    @Test
    fun `classifies dependency config migration and ci changes`() {
        val report = engine.analyze(
            listOf(
                changed("package-lock.json", after = "{}"),
                changed("config/application.yml", after = "feature: true"),
                changed("db/migrations/V12__users.sql", after = "alter table users add active bool;"),
                changed(".github/workflows/build.yml", after = "name: build"),
            ),
        )

        assertEquals(
            setOf("dependency", "config", "migration", "ci"),
            report.findings.map { it.ruleId }.toSet(),
        )
        assertEquals(RiskLevel.HIGH, report.overallLevel)
    }

    @Test
    fun `detects public api additions with a line location`() {
        val report = engine.analyze(
            listOf(
                changed(
                    path = "src/UserController.java",
                    before = "class UserController {}",
                    after = """
                        class UserController {
                          public User getUser(String id) { return null; }
                        }
                    """.trimIndent(),
                ),
                changed("src/UserControllerTest.java", after = "class UserControllerTest {}"),
            ),
        )

        val finding = report.findings.single { it.ruleId == "public.api" }
        assertEquals(2, finding.line)
    }

    @Test
    fun `applies file and line size thresholds`() {
        val thresholdEngine = RiskEngine(
            RiskEngine.Thresholds(
                maxFiles = 1,
                maxTotalLines = 2,
                maxSingleFileLines = 1,
                highSingleFileLines = 3,
            ),
        )
        val report = thresholdEngine.analyze(
            listOf(
                changed("docs/a.md", after = "a\nb\nc\nd"),
                changed("docs/b.md", after = "x"),
            ),
        )

        assertTrue(report.findings.any { it.ruleId == "size.files" })
        assertTrue(report.findings.any { it.ruleId == "size.total" })
        assertTrue(report.findings.any { it.ruleId == "size.single" })
        assertEquals(RiskLevel.HIGH, report.overallLevel)
    }

    @Test
    fun `reports unreadable content while still applying path checks`() {
        val report = engine.analyze(
            listOf(
                ChangedFile(
                    path = ".env.production",
                    status = ChangeStatus.ADDED,
                    beforeContent = null,
                    afterContent = null,
                    contentAvailable = false,
                ),
            ),
        )

        assertTrue(report.findings.any { it.ruleId == "content.unavailable" })
        assertTrue(report.findings.any { it.ruleId == "high.path" })
    }

    private fun changed(
        path: String,
        before: String? = null,
        after: String? = "",
    ) = ChangedFile(
        path = path,
        status = if (before == null) ChangeStatus.ADDED else ChangeStatus.MODIFIED,
        beforeContent = before,
        afterContent = after,
    )
}
