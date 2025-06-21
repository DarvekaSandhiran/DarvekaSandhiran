/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 * @author NikLever / http://niklever.com
 */

class VRButton {

    constructor(renderer, options) {
        this.renderer = renderer;

        if (options !== undefined) {
            this.onSessionStart = options.onSessionStart;
            this.onSessionEnd = options.onSessionEnd;
            this.sessionInit = options.sessionInit;
            this.sessionMode = (options.inline !== undefined && options.inline) ? 'inline' : 'immersive-vr';
        } else {
            this.sessionMode = 'immersive-vr';
        }

        if (this.sessionInit === undefined)
            this.sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor'] };

        if ('xr' in navigator) {

            const button = document.createElement('button');
            button.style.display = 'none';
            button.style.height = '50px';

            navigator.xr.isSessionSupported(this.sessionMode).then((supported) => {
                supported ? this.showEnterVR(button) : this.showWebXRNotFound(button);
                if (options && options.vrStatus) options.vrStatus(supported);
            });

            document.body.appendChild(button);

        } else {

            const message = document.createElement('a');

            if (window.isSecureContext === false) {
                message.href = document.location.href.replace(/^http:/, 'https:');
                message.innerHTML = 'WEBXR NEEDS HTTPS';
            } else {
                message.href = 'https://immersiveweb.dev/';
                message.innerHTML = 'WEBXR NOT AVAILABLE';
            }

            message.style.left = '0px';
            message.style.width = '100%';
            message.style.textDecoration = 'none';

            this.stylizeElement(message, false);
            message.style.bottom = '0px';
            message.style.opacity = '1';

            document.body.appendChild(message);

            if (options?.vrStatus) options.vrStatus(false);
        }
    }

    showEnterVR(button) {
        let currentSession = null;
        const self = this;

        this.stylizeElement(button, true, 16, true);

        function onSessionStarted(session) {
            session.addEventListener('end', onSessionEnded);

            self.renderer.xr.setSession(session);
            self.stylizeElement(button, false, 14, true);

            button.textContent = 'EXIT GAMING ROOM';
            currentSession = session;

            if (self.onSessionStart !== undefined) self.onSessionStart();
        }

        function onSessionEnded() {
            currentSession.removeEventListener('end', onSessionEnded);

            self.stylizeElement(button, true, 14, true);
            button.textContent = 'ENTER GAMING ROOM';

            currentSession = null;
            if (self.onSessionEnd !== undefined) self.onSessionEnd();
        }

        button.style.display = '';
        button.style.right = '20px';
        button.style.width = '180px';
        button.style.cursor = 'pointer';
        button.innerHTML = '🎮 VR ROOM';

        button.onmouseenter = function () {
            button.textContent = (currentSession === null) ? 'ENTER GAMING ROOM' : 'EXIT GAMING ROOM';
            button.style.opacity = '1.0';
            button.style.boxShadow = '0 0 20px #0ff, 0 0 40px #0ff inset';
            button.style.transform = 'scale(1.05)';
        };

        button.onmouseleave = function () {
            button.innerHTML = '🎮 VR ROOM';
            button.style.opacity = '0.7';
            button.style.boxShadow = '0 0 10px #0ff, 0 0 20px #0ff inset';
            button.style.transform = 'scale(1.0)';
        };

        button.onclick = function () {
            if (currentSession === null) {
                navigator.xr.requestSession(self.sessionMode, self.sessionInit).then(onSessionStarted);
            } else {
                currentSession.end();
            }
        };
    }

    disableButton(button) {
        button.style.cursor = 'auto';
        button.style.opacity = '0.5';
        button.onmouseenter = null;
        button.onmouseleave = null;
        button.onclick = null;
    }

    showWebXRNotFound(button) {
        this.stylizeElement(button, false);
        this.disableButton(button);

        button.style.display = '';
        button.style.width = '100%';
        button.style.right = '0px';
        button.style.bottom = '0px';
        button.style.border = '';
        button.style.opacity = '1';
        button.style.fontSize = '13px';
        button.textContent = 'VR NOT SUPPORTED';
    }

    stylizeElement(element, active = true, fontSize = 13, ignorePadding = false) {
        element.style.position = 'absolute';
        element.style.bottom = '20px';
        if (!ignorePadding) element.style.padding = '12px 16px';
        element.style.border = '2px solid #0ff';
        element.style.borderRadius = '12px';
        element.style.background = active ? 'linear-gradient(145deg, #0f0c29, #302b63, #24243e)' : '#111';
        element.style.color = '#0ff';
        element.style.font = `bold ${fontSize}px 'Orbitron', sans-serif`;
        element.style.textAlign = 'center';
        element.style.opacity = '0.9';
        element.style.outline = 'none';
        element.style.zIndex = '999';
        element.style.boxShadow = '0 0 10px #0ff, 0 0 20px #0ff inset';
        element.style.textShadow = '0 0 5px #0ff';
        element.style.transition = 'all 0.3s ease';
    }
}

export { VRButton };
