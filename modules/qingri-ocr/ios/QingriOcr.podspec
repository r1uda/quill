Pod::Spec.new do |s|
  s.name = 'QingriOcr'
  s.version = '0.1.0'
  s.summary = 'Local Chinese text recognition for Qingri'
  s.description = 'App-local OCR with Apple Vision; images stay on the device.'
  s.license = { :type => 'MIT' }
  s.author = 'Qingri'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.frameworks = 'Vision', 'UIKit', 'ImageIO'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
