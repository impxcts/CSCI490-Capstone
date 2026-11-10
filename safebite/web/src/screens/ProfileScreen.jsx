// The Profile tab. Click chips to pick what you avoid, or type your own.
// Every change saves to Flask right away.

import { useEffect, useState } from "react";
import { getProfile, saveProfile } from "../api";

export default function ProfileScreen({ token, user, onLogOut }) {
  const [groups, setGroups] = useState([]); // the preset options (allergens, sugars, IBD)
  const [triggers, setTriggers] = useState([]); // what you avoid, like ["milk", "garlic"]
  const [newTrigger, setNewTrigger] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getProfile(token).then((data) => {
      setGroups(data.catalog);
      setTriggers(data.triggers);
    });
  }, [token]);

  async function save(newList) {
    setTriggers(newList); // update the screen right away
    setStatus("Saving…");
    try {
      const data = await saveProfile(token, newList);
      setTriggers(data.triggers);
      setStatus("Saved");
    } catch (err) {
      setStatus(err.message);
    }
  }

  // click a chip to add it, click again to remove it
  function toggle(name) {
    if (triggers.includes(name)) {
      save(triggers.filter((t) => t !== name));
    } else {
      save([...triggers, name]);
    }
  }

  function addYourOwn(event) {
    event.preventDefault();
    const name = newTrigger.trim().toLowerCase();
    if (name && !triggers.includes(name)) {
      save([...triggers, name]);
    }
    setNewTrigger("");
  }

  // anything you typed yourself (not one of the presets)
  const presetNames = groups.flatMap((group) => group.triggers.map((t) => t.key));
  const yourOwn = triggers.filter((t) => !presetNames.includes(t));

  return (
    <div className="screen">
      <h1>Your profile</h1>
      <p className="muted">
        {triggers.length} on your avoid list {status && `· ${status}`}
      </p>

      {groups.map((group) => (
        <div key={group.title} className="card">
          <h3>{group.title}</h3>
          <div className="chips">
            {group.triggers.map((t) => (
              <button
                key={t.key}
                className={triggers.includes(t.key) ? "chip on" : "chip"}
                onClick={() => toggle(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <h3>Your own</h3>
        <form className="type-barcode" onSubmit={addYourOwn}>
          <input
            placeholder="e.g. garlic"
            aria-label="Ingredient to avoid"
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
          />
          <button className="button small">Add</button>
        </form>
        <div className="chips">
          {yourOwn.map((name) => (
            <button key={name} className="chip on" onClick={() => toggle(name)}>
              {name} ✕
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="muted">Logged in as {user.email}</p>
        <button className="link danger" onClick={onLogOut}>
          Log out
        </button>
      </div>
    </div>
  );
}
