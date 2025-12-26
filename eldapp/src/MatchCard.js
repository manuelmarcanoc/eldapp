import React from 'react';
import './App.css';

function MatchCard({ competition, round, team1, team2, date, time }) {
    return (
        <div className="match-card">
            <div className="match-header">
                <span className="competition-name">{competition}</span>
                {round && <span className="round-name"> · {round}</span>}
            </div>

            <div className="match-content">
                <div className="teams-column">
                    <div className="team-row">
                        <span className="team-name">{team1.name}</span>
                    </div>
                    <div className="team-row">
                        <span className="team-name">{team2.name}</span>
                    </div>
                </div>

                <div className="divider-vertical"></div>

                <div className="time-column">
                    <div className="match-date">{date}</div>
                    <div className="match-time">{time}</div>
                </div>
            </div>
        </div>
    );
}

export default MatchCard;
