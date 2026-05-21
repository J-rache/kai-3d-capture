# Kai Browser Client Package

Use `kai-capture-client.mjs` from Kai Browser when Kai is ready to attach the capture workflow.

The browser should:

1. Load a user-selected video or image set.
2. Sample frames locally with `sampleVideoElement` or `sampleImageElement`.
3. Ask the user for one known measurement.
4. Send compact sampled frames to the localhost worker with `client.reconstruct(job)`.
5. Pass the returned manifest to Kai CAD as a reference mesh layer.

This integration does not require Kai Browser to upload private raw media to a cloud service.

