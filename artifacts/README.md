# Validation and build artifacts

The source delivery included local validation reports. GitHub Pages publication reruns the Node suite and Chromium desktop/touch integration suite, repacks all ten npm packages and builds the standalone/static game from source.

The first successful publication commits the generated distributions, tarballs and new browser screenshots here. These screenshots are fresh captures of the tested build, not byte-for-byte copies of the original development-session captures. Subsequent runs retain fresh reports and captures in the downloadable source release and Actions artifact rather than repeatedly adding binary screenshots to Git history.

`browser-tests.json` identifies the actually tested rendering backend. Desktop/touch emulation does not establish physical mobile-device or WebGPU hardware certification.
