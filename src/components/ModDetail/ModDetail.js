import React from 'react';
import ModImage from '../ModImage/ModImage';
import ModStats from '../ModStats/ModStats';
import CharacterAvatar from '../CharacterAvatar/CharacterAvatar';
import './ModDetail.css';

class ModDetail extends React.Component {
  render() {
    const mod = this.props.mod;

    return (
      <div className='mod-detail'>
        <ModImage mod={mod}/>
        <CharacterAvatar name={mod.currentCharacter}/>
        <ModStats mod={mod} />
      </div>
    );
  }
}

export default ModDetail;
