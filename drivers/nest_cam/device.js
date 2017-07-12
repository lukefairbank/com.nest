'use strict';

const Homey = require('homey');
const NestDevice = require('./../nestDevice');

class NestCam extends NestDevice {

	onInit() {
		super.onInit();

		// Register device trigger flow cards
		this.startedStreamingFlowTriggerDevice = new Homey.FlowCardTriggerDevice('started_streaming');
		this.startedStreamingFlowTriggerDevice.register();

		this.stoppedStreamingFlowTriggerDevice = new Homey.FlowCardTriggerDevice('stopped_streaming');
		this.stoppedStreamingFlowTriggerDevice.register();
	}

	/**
	 * Create client and bind event listeners.
	 * @returns {*}
	 */
	async createClient() {

		// Create thermostat
		this.client = Homey.app.nestAccount.createCam(this.getData().id);

		// If client construction failed, set device unavailable
		if (!this.client) return this.setUnavailable(Homey.__('removed_externally'));

		this.client.on('isStreaming', isStreaming => {

			// Detect change
			if (typeof this.isStreaming !== 'undefined') {

				// Check if started or ended
				if (this.isStreaming === false && isStreaming === true) {

					// Trigger Flow
					this.startedStreamingFlowTriggerDevice.trigger(this)
						.catch(err => {
							if (err) return this.error('Error triggeringDevice:', err);
						});
				} else if (this.isStreaming === true && isStreaming === false) {

					// Trigger Flow
					this.stoppedStreamingFlowTriggerDevice.trigger(this)
						.catch(err => {
							if (err) return this.error('Error triggeringDevice:', err);
						});
				}
			}
			this.isStreaming = isStreaming;
		});

		// Register snapshot image and snapshot flow token
		const snapshotImage = await this.registerSnapShotImage();
		const imageToken = await this.registerSnapshotFlowToken(snapshotImage);
		this.log('registered snapshot image and flow token');
	}

	/**
	 * Register a snapshot image, which will later be fetched from the Nest API.
	 * @returns {Promise|Error}
	 */
	registerSnapShotImage() {

		// Register new image
		// TODO check if nest provides jpg images
		const snapshotImage = new Homey.Image('jpg');

		// This method is called when the image has to be read
		snapshotImage.setBuffer((args, callback) => {

			// Retrieve last snapshot from Nest API
			this.client.getImageBufferFromSnapshotUrl()
				.then(buffer => callback(null, buffer))
				.catch(err => {
					this.error('Error on getImageBufferFromSnapshotUrl', err);
					return callback(err);
				});
		});

		// Register image
		return snapshotImage
			.register()
			.catch(err => this.error('Error registering snapshot image', err));

	}

	/**
	 * Register image flow token, which holds a snapshot image.
	 * @param snapshotImage
	 * @returns {*}
	 */
	registerSnapshotFlowToken(snapshotImage) {
		this.log('snapshot image registered');

		// Create new flow image token
		const myImageToken = new Homey.FlowToken('snapshot_token', {
			type: 'image',
			title: {
				en: 'Snapshot',
			},
		});

		// Register flow image token
		return myImageToken
			.register()
			.then(() => {
				this.log('image token registered');

				// Update image in token
				myImageToken.setValue(snapshotImage)
					.catch(err => this.error('failed to setValue() on image token', err));
			});
	}
}

module.exports = NestCam;
