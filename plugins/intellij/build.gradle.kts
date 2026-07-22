import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.intellij.platform")
}

group = "dev.qcoding.aichangeradar"
version = providers.gradleProperty("pluginVersion").get()

dependencies {
    intellijPlatform {
        val localIdeaPath = providers.gradleProperty("localIdeaPath").orNull
        if (localIdeaPath != null) {
            local(localIdeaPath)
        } else {
            intellijIdea(providers.gradleProperty("platformVersion").get())
        }
        testFramework(TestFrameworkType.Platform)
        pluginVerifier()
    }
    testImplementation("junit:junit:4.13.2")
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_21
        jvmDefault = JvmDefaultMode.NO_COMPATIBILITY
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "dev.qcoding.aichangeradar"
        name = "AI Change Radar"
        version = project.version.toString()
        description = """
            <p><strong>Local risk checks for AI-assisted code changes.</strong></p>
            <p>AI Change Radar reviews selected commit changes and the current working tree for
            sensitive assignments, high-risk paths, missing tests, dependency and configuration
            changes, migrations, CI changes, large diffs, and public API changes.</p>
            <p>Runs locally. No LLM required. No source code upload. No external CLI required.</p>
            <p>Powered by the open-source Change Evidence engine.</p>
        """.trimIndent()
        changeNotes = """
            <ul>
              <li>Native pre-commit analysis with explicit Continue Commit or Cancel Commit choices.</li>
              <li>Manual analysis from the Tools menu.</li>
              <li>Risk report tool window with file navigation.</li>
              <li>English and Simplified Chinese UI.</li>
            </ul>
        """.trimIndent()
        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild")
        }
        vendor {
            name = "QCoding"
            email = "qcodingdev@users.noreply.github.com"
            url = "https://github.com/qcodingdev/change-evidence"
        }
    }
    pluginVerification {
        ides {
            current()
        }
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }
}

tasks {
    test {
        useJUnit()
    }
    wrapper {
        gradleVersion = providers.gradleProperty("gradleVersion").get()
        distributionType = Wrapper.DistributionType.BIN
    }
}
