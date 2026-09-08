// Function to update live alerts & trigger siren ONLY if inside user's area
async function fetchLiveAlerts() {
    const feedList = document.getElementById('alert-feed-list');
    const warningCountEl = document.getElementById('active-warnings-count');
    const watchCountEl = document.getElementById('active-watches-count');

    if (!feedList) return;

    try {
        const response = await fetch('/api/live-alerts');
        const data = await response.json();

        if (data.features) {
            feedList.innerHTML = '';
            let totalWarnings = 0;
            let totalWatches = 0;

            data.features.forEach(alert => {
                const props = alert.properties;
                const isSevere = props.severity === 'Extreme' || props.severity === 'Severe';
                
                if (isSevere) totalWarnings++; else totalWatches++;

                // Highlight if alert matches logged in user county
                const userCounty = data.user_county;
                const isLocal = userCounty && props.areaDesc.toLowerCase().includes(userCounty.toLowerCase());

                const alertDiv = document.createElement('div');
                alertDiv.className = `feed-item ${isSevere ? 'severe' : ''} ${isLocal ? 'local-alert' : ''}`;
                alertDiv.innerHTML = `
                    <h5>${props.event} ${isLocal ? '<span class="badge badge-danger">YOUR AREA</span>' : ''}</h5>
                    <p><strong>Area:</strong> ${props.areaDesc}</p>
                    <p><strong>Severity:</strong> ${props.severity}</p>
                `;
                feedList.appendChild(alertDiv);
            });

            if (warningCountEl) warningCountEl.innerText = totalWarnings;
            if (watchCountEl) watchCountEl.innerText = totalWatches;

            // SIREN BEEP LOGIC: Trigger sound ONLY if a local emergency exists for user's area!
            if (data.local_emergency && !isSirenPlaying) {
                const bannerMsg = document.getElementById('emergency-message');
                if (bannerMsg) {
                    bannerMsg.innerText = `CRITICAL WARNING IN YOUR COUNTY (${data.user_county} County)! TAKE SHELTER!`;
                }
                playEmergencySiren();
            } else if (!data.local_emergency && isSirenPlaying) {
                stopEmergencySiren(); // Keep silent if no severe warning in user's area
            }
        }
    } catch (err) {
        console.error("Error fetching live alerts:", err);
    }
}