"""Remenda o LibretroDroid 0.14.0 para o Vortex (usado no CI antes de compilar a biblioteca).

1) O buffer onde o núcleo desenha deixa de ser apagado e recriado quando o tamanho da imagem muda: o Dolphin guarda o
   endereço do buffer e, se ele some, continua desenhando num buffer que não existe mais (tela preta com som normal).
   Agora o mesmo buffer é redimensionado por dentro e o endereço não muda.
2) Mensagens "VORTEX ..." no log (tamanho das imagens, endereço do buffer, cor do pixel do meio) para o diagnóstico do jogo.
3) Só as ABIs usadas pelo Vortex, para compilar mais rápido.
"""
import sys, pathlib

raiz = pathlib.Path(sys.argv[1])
cpp = raiz / "libretrodroid/src/main/cpp"


def trocar(arquivo, antes, depois):
    p = arquivo if isinstance(arquivo, pathlib.Path) else cpp / arquivo
    t = p.read_text()
    if t.count(antes) != 1:
        sys.exit(f"patch: trecho não encontrado (ou repetido) em {p}: {antes[:60]!r}")
    p.write_text(t.replace(antes, depois, 1))


# 1) redimensionar por dentro, mantendo o mesmo endereço do buffer
trocar("renderers/es3/es3utils.h", "    static void deleteFramebuffer(std::unique_ptr<Framebuffer> data);",
"""    static void deleteFramebuffer(std::unique_ptr<Framebuffer> data);

    // Vortex: muda o tamanho sem trocar o número do buffer (o núcleo pode ter guardado esse número)
    static void resizeFramebuffer(
        Framebuffer &fb,
        unsigned int width,
        unsigned int height,
        bool linear,
        bool includeDepth,
        bool includeStencil
    );""")

trocar("renderers/es3/es3utils.cpp", "void ES3Utils::deleteFramebuffer(std::unique_ptr<ES3Utils::Framebuffer> data) {",
"""void ES3Utils::resizeFramebuffer(
    Framebuffer &fb,
    unsigned int width,
    unsigned int height,
    bool linear,
    bool includeDepth,
    bool includeStencil
) {
    glBindFramebuffer(GL_FRAMEBUFFER, fb.framebuffer);

    glDeleteTextures(1, &fb.texture);
    glGenTextures(1, &fb.texture);
    glBindTexture(GL_TEXTURE_2D, fb.texture);
    glTexStorage2D(GL_TEXTURE_2D, 1, GL_RGBA8, width, height);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, linear ? GL_LINEAR : GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, linear ? GL_LINEAR : GL_NEAREST);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, fb.texture, 0);

    if (includeDepth) {
        if (!fb.depth.has_value()) {
            unsigned int depthBuffer;
            glGenRenderbuffers(1, &depthBuffer);
            fb.depth = depthBuffer;
        }
        glBindRenderbuffer(GL_RENDERBUFFER, fb.depth.value());
        glRenderbufferStorage(GL_RENDERBUFFER, includeStencil ? GL_DEPTH24_STENCIL8 : GL_DEPTH_COMPONENT16, width, height);
        glFramebufferRenderbuffer(
            GL_FRAMEBUFFER,
            includeStencil ? GL_DEPTH_STENCIL_ATTACHMENT : GL_DEPTH_ATTACHMENT,
            GL_RENDERBUFFER,
            fb.depth.value()
        );
    }

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
        LOGE("VORTEX: buffer incompleto depois de redimensionar %ux%u", width, height);
    }

    fb.width = width;
    fb.height = height;

    glBindTexture(GL_TEXTURE_2D, 0);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glBindRenderbuffer(GL_RENDERBUFFER, 0);
}

void ES3Utils::deleteFramebuffer(std::unique_ptr<ES3Utils::Framebuffer> data) {""")

trocar("renderers/es3/framebufferrenderer.cpp", """    ES3Utils::deleteFramebuffer(std::move(framebuffer));
    framebuffer = ES3Utils::createFramebuffer(
        width,
        height,
        shaders.linearTexture,
        false,
        depth,
        stencil
    );""",
"""    if (framebuffer != nullptr && framebuffer->framebuffer != 0) {
        LOGI("VORTEX: buffer do jogo redimensionado para %ux%u (mesmo endereco %u)", width, height, framebuffer->framebuffer);
        ES3Utils::resizeFramebuffer(*framebuffer, width, height, shaders.linearTexture, depth, stencil);
        return;
    }

    framebuffer = ES3Utils::createFramebuffer(
        width,
        height,
        shaders.linearTexture,
        false,
        depth,
        stencil
    );
    LOGI("VORTEX: buffer do jogo criado %ux%u (endereco %u)", width, height, framebuffer->framebuffer);""")

# 2) mensagens para o diagnóstico
trocar("libretrodroid.cpp", "uintptr_t LibretroDroid::callback_get_current_framebuffer() {\n    return LibretroDroid::getInstance().handleGetCurrentFrameBuffer();",
"""uintptr_t LibretroDroid::callback_get_current_framebuffer() {
    static unsigned vortexChamadas = 0;
    uintptr_t fbo = LibretroDroid::getInstance().handleGetCurrentFrameBuffer();
    if (++vortexChamadas <= 4 || vortexChamadas % 1000 == 0) LOGI("VORTEX: o nucleo pediu o buffer (chamada %u) -> %lu", vortexChamadas, (unsigned long) fbo);
    return fbo;""")

trocar("libretrodroid.cpp", "    if (video) {\n        video->onNewFrame(data, width, height, pitch);\n",
"""    static unsigned vortexQuadros = 0;
    vortexQuadros++;
    if (vortexQuadros <= 6 || vortexQuadros % 600 == 0) {
        LOGI("VORTEX: quadro %u do nucleo: %ux%u dados=%p buffer=%lu", vortexQuadros, width, height, data, video ? (unsigned long) video->getCurrentFramebuffer() : 0UL);
    }
    if (video) {
        video->onNewFrame(data, width, height, pitch);
""")

trocar("libretrodroid.cpp", "        if (video->rendersInVideoCallback()) {\n            video->renderFrame();\n        }\n    }\n}",
"""        if (video->rendersInVideoCallback()) {
            video->renderFrame();
        }

        if (vortexQuadros == 150 || vortexQuadros == 900) {
            unsigned char px[4] = {0, 0, 0, 0};
            GLint lido = 0;
            glGetIntegerv(GL_FRAMEBUFFER_BINDING, &lido);
            glBindFramebuffer(GL_READ_FRAMEBUFFER, (GLuint) video->getCurrentFramebuffer());
            glReadPixels(width / 2, height / 2, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, px);
            GLenum erro = glGetError();
            LOGI("VORTEX: pixel do meio do buffer no quadro %u = %d %d %d %d (erro GL %d)", vortexQuadros, px[0], px[1], px[2], px[3], (int) erro);
            glBindFramebuffer(GL_READ_FRAMEBUFFER, 0);
        }
    }
}""")
trocar("libretrodroid.cpp", '#include <EGL/egl.h>\n', '#include <EGL/egl.h>\n#include <GLES3/gl3.h>\n')

trocar("environment.cpp", "    bottomLeftOrigin = hw_render_callback->bottom_left_origin;\n",
"""    bottomLeftOrigin = hw_render_callback->bottom_left_origin;
    LOGI("VORTEX: nucleo pediu desenho por hardware: tipo=%d versao=%u.%u profundidade=%d stencil=%d origem_embaixo=%d",
         (int) hw_render_callback->context_type, hw_render_callback->version_major, hw_render_callback->version_minor,
         (int) useDepth, (int) useStencil, (int) bottomLeftOrigin);
""")

# 3) só as ABIs do Vortex
trocar(raiz / "libretrodroid/build.gradle", "        versionName \"1.0\"\n", "        versionName \"1.0\"\n        ndk { abiFilters 'arm64-v8a', 'armeabi-v7a' }\n")
print("patch aplicado")
