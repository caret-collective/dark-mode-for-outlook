(() => {
	'use strict';

	// 0-pad a number to 2 digits
	const pad = (num: number): string => {
		return num.toString().padStart(2, '0');
	};

	const log = (msg: string) => {
		const d = new Date();

		console.debug('[' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '.' + pad(d.getSeconds()) + '] DMFO: ' + msg);
	};

	log('Content script loaded')

	chrome.storage.sync.get({ composePaneStyling: false }, ({ composePaneStyling }: { composePaneStyling: boolean }) => {
		log('Options loaded')

		const getBottomBar = (composePane: Element): HTMLElement | null => {
			return composePane.querySelector('div[style="background-color: rgb(250, 249, 248);"]')
		};

		const styleBottomBar = (bottomBar: HTMLElement) => {
			bottomBar.style = ''
		};

		const getComposePane = (): HTMLElement | null => {
			return document.querySelector('#ReadingPaneContainerId > div:first-child > div:first-child > div:first-child > div:first-child[class]')
		};

		const styleComposePane = (composePane: HTMLElement) => {
			composePane.className = ''

			let bottomBar = getBottomBar(composePane)

			if (!bottomBar) {
				log('Watching for bottom bar')
				const observer = new MutationObserver((mutations) => {
					mutations.forEach((mutation) => {
						if (!mutation.addedNodes) {
							return
						}

						bottomBar = getBottomBar(composePane)

						if (bottomBar) {
							log('Found bottom bar')
							styleBottomBar(bottomBar)
							log('Done watching for bottom bar')
							observer.disconnect()
						}
					})
				});

				observer.observe(composePane, {
					childList: true, subtree: true, attributes: false, characterData: false
				});
			} else {
				styleBottomBar(bottomBar)
			}
		};

		if (composePaneStyling) {
			const link = document.createElement('link');

			link.href = chrome.runtime.getURL('css/compose.css');
			link.type = 'text/css';
			link.rel = 'stylesheet';

			document.getElementsByTagName('head')[0].appendChild(link);

			let composePane = getComposePane()

			if (!composePane) {
				log('Watching for compose pane')
				const observer = new MutationObserver((mutations) => {
					mutations.forEach((mutation) => {
						if (!mutation.addedNodes) {
							return
						}

						composePane = getComposePane()

						if (composePane) {
							log('Found compose pane')
							styleComposePane(composePane)
							log('Done watching for compose pane')
							observer.disconnect()
						}
					})
				});

				const app = document.getElementById('app');

				if (!app) {
					return;
				}

				observer.observe(app, {
					childList: true, subtree: true, attributes: false, characterData: false
				});
			} else {
				styleComposePane(composePane)
			}
		}
	});
})();
