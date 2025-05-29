import express from 'express';
import open from 'open';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

const clientId = 'be04db1a0c07447f92cb5d2d7eb524c0';
const clientSecret = '9fa4eb9256d34b258ccd17fc539b24aa';
const redirectUri = 'https://caa1-190-102-52-164.ngrok-free.app/callback';

const playlistId = '62UM7Dd9Uy3lPaiWSwCZVn';
const userIdToRemove = '223mzmj5xwozpfwckhn6g3zja'; // ID do usuário a remover

let accessToken = '';

function getAuthUrl() {
  const scope = [
    'playlist-read-private',
    'playlist-modify-private',
    'playlist-modify-public'
  ].join(' ');

  const url =
    'https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return url;
}

async function getTokens(code) {
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirectUri);

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }
  return await response.json();
}

async function getPlaylistTracks() {
  let allTracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to get tracks: ${response.status}`);
    }

    const data = await response.json();
    allTracks = allTracks.concat(data.items);
    nextUrl = data.next;
  }

  return allTracks;
}

function filterTracksByUser(tracks, userId) {
  const filtered = tracks.filter((item) => {
    return item.added_by?.id === userId;
  });

  const allUsers = [...new Set(tracks.map(t => t.added_by?.id).filter(Boolean))];
  console.log('Usuários encontrados na playlist:', allUsers);

  return filtered;
}

async function removeTracks(tracks) {
  if (tracks.length === 0) return;

  const uris = tracks.map((item) => ({ uri: item.track.uri }));

  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks: uris }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to remove tracks: ${errorData.error.message}`);
  }
}

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokens = await getTokens(code);
    accessToken = tokens.access_token;
    res.send('Autenticado! Pode fechar esta aba.');
    console.log('Access Token obtido. Buscando músicas...');

    const tracks = await getPlaylistTracks();
    const tracksToRemove = filterTracksByUser(tracks, userIdToRemove);

    console.log(`Encontradas ${tracksToRemove.length} faixas adicionadas pelo usuário ${userIdToRemove}. Removendo...`);
    await removeTracks(tracksToRemove);
    console.log('Remoção concluída!');
    process.exit();
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro na autenticação');
  }
});

app.listen(8888, () => {
  console.log('Servidor iniciado em http://localhost:8888');
  open(getAuthUrl());
});
