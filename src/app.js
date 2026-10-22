const onxrloaded = () => {
  XR8.XrController.configure({
    imageTargetData: [
      require('../image-targets/10_5_LandUse_Zvikov.json'),
      require('../image-targets/10_4_LandUse_Frymburk.json'),
      require('../image-targets/Zacvik_SKEN_A4_image_target.json'),
    ],
  })
  XR8.addCameraPipelineModule(LandingPage.pipelineModule())
}
window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)

