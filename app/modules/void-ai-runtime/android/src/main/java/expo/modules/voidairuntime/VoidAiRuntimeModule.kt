package expo.modules.voidairuntime

import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class VoidAiRuntimeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VoidAiRuntime")

    // `Coroutine` is what lets these bodies call suspend functions (withContext, Flow.collect). A plain
    // AsyncFunction { } body is not a coroutine, and the build failed with
    // "Suspend function 'withContext' can only be called from a coroutine or another suspend function".
    AsyncFunction("checkModel") Coroutine { modelPath: String ->
      withContext(Dispatchers.IO) {
        val file = File(modelPath)
        require(file.exists() && file.isFile) { "Model file does not exist." }
        require(file.extension.equals("litertlm", ignoreCase = true)) {
          "Choose a LiteRT-LM .litertlm model file."
        }
        val engine = Engine(EngineConfig(modelPath = file.absolutePath))
        try {
          engine.initialize()
        } finally {
          engine.close()
        }
        true
      }
    }

    AsyncFunction("generate") Coroutine { modelPath: String, prompt: String ->
      withContext(Dispatchers.IO) {
        require(prompt.isNotBlank()) { "Prompt cannot be empty." }
        val file = File(modelPath)
        require(file.exists() && file.isFile) { "Model file does not exist. Load the model again." }

        val engine = Engine(EngineConfig(modelPath = file.absolutePath))
        try {
          engine.initialize()
          val conversation = engine.createConversation()
          try {
            val output = StringBuilder()
            conversation.sendMessageAsync(prompt).collect { token ->
              output.append(token)
            }
            output.toString()
          } finally {
            conversation.close()
          }
        } finally {
          engine.close()
        }
      }
    }
  }
}
