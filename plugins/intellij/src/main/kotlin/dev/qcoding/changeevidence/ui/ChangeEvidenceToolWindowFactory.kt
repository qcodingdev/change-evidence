package dev.qcoding.changeevidence.ui

import com.intellij.openapi.Disposable
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.table.JBTable
import com.intellij.ui.JBColor
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import dev.qcoding.changeevidence.actions.AnalysisRunner
import dev.qcoding.changeevidence.analysis.RiskFinding
import dev.qcoding.changeevidence.analysis.RiskReport
import dev.qcoding.changeevidence.i18n.ChangeEvidenceBundle
import dev.qcoding.changeevidence.services.AnalysisReportService
import java.awt.BorderLayout
import java.awt.FlowLayout
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.nio.file.Paths
import javax.swing.JButton
import javax.swing.JPanel
import javax.swing.ListSelectionModel
import javax.swing.table.AbstractTableModel

class ChangeEvidenceToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = ReportPanel(project)
        val content = toolWindow.contentManager.factory.createContent(panel, "", false)
        content.setDisposer(panel)
        toolWindow.contentManager.addContent(content)
    }

    companion object {
        const val ID = "AI Change Radar"
    }
}

private class ReportPanel(
    private val project: Project,
) : JPanel(BorderLayout()), Disposable {
    private val summary = JBLabel(ChangeEvidenceBundle.message("toolwindow.empty"))
    private val tableModel = FindingTableModel()
    private val table = JBTable(tableModel)

    init {
        border = JBUI.Borders.empty(8)

        val header = JPanel(BorderLayout())
        header.isOpaque = false
        summary.border = JBUI.Borders.emptyRight(12)
        header.add(summary, BorderLayout.CENTER)

        val actionPanel = JPanel(FlowLayout(FlowLayout.RIGHT, 0, 0))
        actionPanel.isOpaque = false
        actionPanel.add(
            JButton(ChangeEvidenceBundle.message("toolwindow.analyze")).apply {
                addActionListener { AnalysisRunner.runCurrentChanges(project) }
            },
        )
        header.add(actionPanel, BorderLayout.EAST)
        add(header, BorderLayout.NORTH)

        table.emptyText.text = ChangeEvidenceBundle.message("toolwindow.empty")
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION)
        table.autoCreateRowSorter = true
        table.setShowGrid(false)
        table.intercellSpacing = JBUI.emptySize()
        table.rowHeight = JBUI.scale(24)
        table.columnModel.getColumn(0).preferredWidth = JBUI.scale(70)
        table.columnModel.getColumn(1).preferredWidth = JBUI.scale(260)
        table.columnModel.getColumn(2).preferredWidth = JBUI.scale(55)
        table.columnModel.getColumn(3).preferredWidth = JBUI.scale(130)
        table.columnModel.getColumn(4).preferredWidth = JBUI.scale(520)
        table.addMouseListener(
            object : MouseAdapter() {
                override fun mouseClicked(event: MouseEvent) {
                    if (event.clickCount == 2 && event.button == MouseEvent.BUTTON1) {
                        navigateSelectedFinding()
                    }
                }
            },
        )
        add(JBScrollPane(table), BorderLayout.CENTER)

        val service = AnalysisReportService.getInstance(project)
        service.subscribe(this, ::render)
        render(service.report)
    }

    private fun render(report: RiskReport) {
        if (report.files.isEmpty()) {
            summary.text = ChangeEvidenceBundle.message("toolwindow.empty")
            summary.foreground = UIUtil.getLabelForeground()
            table.emptyText.text = ChangeEvidenceBundle.message("toolwindow.empty")
        } else {
            summary.text = ChangeEvidenceBundle.message(
                "toolwindow.summary",
                ChangeEvidenceBundle.riskLevel(report.overallLevel),
                report.files.size,
                report.totalAdditions,
                report.totalDeletions,
                report.findings.size,
            )
            summary.foreground = when (report.overallLevel) {
                dev.qcoding.changeevidence.analysis.RiskLevel.HIGH -> UIUtil.getErrorForeground()
                dev.qcoding.changeevidence.analysis.RiskLevel.MEDIUM -> JBColor.ORANGE
                else -> UIUtil.getLabelForeground()
            }
            table.emptyText.text = ChangeEvidenceBundle.message(
                "toolwindow.no.findings",
                report.files.size,
            )
        }
        tableModel.update(report.findings)
    }

    private fun navigateSelectedFinding() {
        val viewRow = table.selectedRow
        if (viewRow < 0) return
        val finding = tableModel.findingAt(table.convertRowIndexToModel(viewRow))
        val relativePath = finding.path ?: return
        val basePath = project.basePath ?: return
        val nioPath = Paths.get(relativePath).let {
            if (it.isAbsolute) it else Paths.get(basePath).resolve(it)
        }.normalize()
        val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(nioPath) ?: return
        OpenFileDescriptor(
            project,
            virtualFile,
            ((finding.line ?: 1) - 1).coerceAtLeast(0),
            0,
        ).navigate(true)
    }

    override fun dispose() = Unit
}

private class FindingTableModel : AbstractTableModel() {
    private var findings: List<RiskFinding> = emptyList()
    private val columns = listOf(
        "toolwindow.column.severity",
        "toolwindow.column.file",
        "toolwindow.column.line",
        "toolwindow.column.rule",
        "toolwindow.column.reason",
    )

    fun update(newFindings: List<RiskFinding>) {
        findings = newFindings
        fireTableDataChanged()
    }

    fun findingAt(row: Int): RiskFinding = findings[row]

    override fun getRowCount(): Int = findings.size

    override fun getColumnCount(): Int = columns.size

    override fun getColumnName(column: Int): String =
        ChangeEvidenceBundle.message(columns[column])

    override fun getValueAt(rowIndex: Int, columnIndex: Int): Any {
        val finding = findings[rowIndex]
        return when (columnIndex) {
            0 -> ChangeEvidenceBundle.riskLevel(finding.level)
            1 -> finding.path.orEmpty()
            2 -> finding.line?.toString().orEmpty()
            3 -> ChangeEvidenceBundle.rule(finding.ruleId)
            4 -> ChangeEvidenceBundle.finding(finding)
            else -> ""
        }
    }
}
