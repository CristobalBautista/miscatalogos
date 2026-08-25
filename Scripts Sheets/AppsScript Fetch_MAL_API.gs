function fetchMAL(id) {
  try {
    const url = MAL_BASE + id + '?fields=' + MAL_FIELDS;
    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'X-MAL-Client-ID': MAL_CLIENT_ID }
    });
    if (resp.getResponseCode() !== 200) {
      Logger.log(`ID: ${id}\tMAL API: ${resp.getResponseCode()} - ${resp.getContentText()} `)
      return null;
    }
    const a = JSON.parse(resp.getContentText());

    const titleEn = a.alternative_titles ? a.alternative_titles.en : '';
    const sinonimosRaw = a.alternative_titles ? (a.alternative_titles.synonyms || []) : [];
    const convertToLower = s => (s || '').toLowerCase().trim(); //
    const sinonimosUtiles = sinonimosRaw.filter(s => { // Filtrar sinonimos que son exactamente iguales si hay alguno.
      const sN = convertToLower(s);
      return sN && sN !== convertToLower(a.title) && sN !== convertToLower(titleEn);
    });
    return {
      id: a.id,
      title: a.title,
      titleEn: titleEn,
      sinonimos: sinonimosUtiles,
      score: a.mean,
      sinopsis: (a.synopsis || '').split("\n\n[Written by MAL Rewrite]")[0],
      episodes: a.num_episodes,
      popularidad: a.popularity,
      mediaType: a.media_type, // 'tv', 'movie', 'ova', 'ona', 'special', etc (minuscula)
      status: a.status, // 'finished_airing' / 'currently_airing' / 'not_yet_aired'
      genres: (a.genres || []).filter(genre => APPROVED_GENRES_ID.includes(genre.id)).map(genre => GENRES_THEMES_DICTIONARY_SPANISH[genre.id]),
      themes: (a.genres || []).filter(theme => APPROVED_THEMES_ID.includes(theme.id)).map(theme => GENRES_THEMES_DICTIONARY_SPANISH[theme.id]),
      startDate: a.start_date || '',
      endDate: a.end_date || '',
      poster: a.main_picture ? a.main_picture.large : '',
      posterMediano: a.main_picture ? a.main_picture.medium : ''
    };
  } catch (err) {
    Logger.log('Error MAL API ID ' + id + ': ' + err);
    return null;
  }
}