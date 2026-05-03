const fs = require("fs");
const path = require("path");
const { withDangerousMod, withProjectBuildGradle } = require("@expo/config-plugins");

const ROOT_MARKER = "// story: async-storage android/local_repo (root)";
const MODULE_MARKER = "// story: async-storage local_repo (module)";

function patchAsyncStorageModuleBuildGradle(projectRoot) {
  const gradlePath = path.join(
    projectRoot,
    "node_modules/@react-native-async-storage/async-storage/android/build.gradle"
  );
  if (!fs.existsSync(gradlePath)) {
    return;
  }

  let contents = fs.readFileSync(gradlePath, "utf8");
  if (contents.includes(MODULE_MARKER)) {
    return;
  }

  if (!contents.includes("org.asyncstorage.shared_storage:storage-android")) {
    return;
  }

  const needle = "repositories {\n    mavenCentral()\n    google()\n}";
  if (!contents.includes(needle)) {
    throw new Error(
      "withAsyncStorageLocalMaven: async-storage android/build.gradle layout changed; update MODULE patch needle."
    );
  }

  const block = `repositories {
    ${MODULE_MARKER}
    maven { url "$rootDir/local_repo" }
    mavenCentral()
    google()
}`;

  contents = contents.replace(needle, block);
  fs.writeFileSync(gradlePath, contents, "utf8");
}

/**
 * v3+ ships `storage-android` only under `android/local_repo`. Gradle must see
 * that Maven repo (root `allprojects` + module `repositories` for isolated resolution).
 */
function withAsyncStorageLocalMaven(config) {
  config = withDangerousMod(config, [
    "android",
    async (c) => {
      patchAsyncStorageModuleBuildGradle(c.modRequest.projectRoot);
      return c;
    },
  ]);

  return withProjectBuildGradle(config, (c) => {
    if (c.modResults.language !== "groovy") {
      return c;
    }
    let contents = c.modResults.contents;
    if (contents.includes(ROOT_MARKER)) {
      return c;
    }

    const block = `    ${ROOT_MARKER}
    maven {
      url "$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo"
    }
`;

    const needle = "allprojects {\n  repositories {\n    google()";
    if (!contents.includes(needle)) {
      throw new Error(
        "withAsyncStorageLocalMaven: expected allprojects.repositories block; update plugin for this Expo/RN template."
      );
    }

    contents = contents.replace(needle, `allprojects {\n  repositories {\n${block}    google()`);
    c.modResults.contents = contents;
    return c;
  });
}

module.exports = withAsyncStorageLocalMaven;
