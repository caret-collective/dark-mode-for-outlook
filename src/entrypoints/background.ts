(() => {
	'use strict';

	// 0-pad a number to 2 digits
	const pad = (num: number): string => {
		return num.toString().padStart(2, '0');
	}

	const log = (msg: string) => {
		const d = new Date();

		console.debug('[' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '.' + pad(d.getSeconds()) + '] DMFO: ' + msg);
	}

	log('Background script loaded')

	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		// Url property is only present when we have the 'tabs' permission
		if (tab.url && 'status' in changeInfo && changeInfo.status === 'loading') {
			chrome.permissions.contains({
				permissions: [],
				origins: [tab.url]
			}, (isGranted) => {
				if (isGranted) {
					log('Permission is granted for ' + tab.url);

					chrome.scripting.insertCSS({
						target: {
							tabId,
							allFrames: true
						},
						files: ['styles/main.css']
					}, () => {
						chrome.scripting.insertCSS({
							target: {
								tabId,
								allFrames: true
							},
							files: ['styles/help.css']
						}, () => {
							log('Injected styles');
						});
					});
				}
			});
		}
	});
})();
