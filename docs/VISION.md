# Perchable

## Part 0 — Why you're building it
- this build will be a test base build for another app so all parts of this needs to be modular
- i want to learn what proper mobile development looks like and what proper tech it should use
- this is the stepping stone of mobile development down the road for us so this is the learning phase but will eventually be polished and shipped
- this will also belong to my portfolio and I plan this to go live also in playstore

## Part 1 — The app
- an app where a user can browse all movies (scrapped by n8n in imdb -> send list to cloudflare db -> app access [is that correct?]) and tag the movie as 'watched' view and track movies a user has watched.
- for people who keeps asking "what to watch?" "can you recommend me a good movie?" "have you watched xxxx?"
- for movie lovers who want to discuss a movie with someone else
- only login is through google login


## Part 2 — Features
- the home page will contain a generic home with movie poster showcase, details pulled from imdb. 
- an "Quick add" area, where a user swipes lef or right to add to his/her collection, the sequence is selectable, from most recent to older or random. clicking on the poster will go to a details page of the movie.
- a "add movie" area , where a user can search the movies to add
- when clicking a movie in the home page, goes to details page of the movie.
- a user can put a caption on each of their watched movies in their "My Collection"
- movies added to collection can be removed
- user profile edit (photo/usertag)
- other users can see what another user has watched and ask about it through DM or comment on the users watched movie.
- profile owners can set whether to enable or disable commenting in his/her collection.
- when viewing a nother user, modal similar to discord modal ("docs/inspo/discord_modal.png") showing user profile, name, date joined, number of movies watched,  followers
- users can follow each other (functions the same as friends)
- user details will keep on going on further updates
- ranking system, movie -> number of people added the movie, most discussed, users with most watched, users with most active

## Part 3 — Look and feel
- look inspo at "docs/inspo/design inspo.jpg" including color
- homepage sample (inspo only, no need to copy exactly) ![homepage sample](<docs/inspo/home inspo.jpg>) 
- colors at ![color pallete](docs/inspo/pallete.jpg)

## Part 4 — Business and constraints
- no ads, neverything for now.... in the future, we will have ads
- platform -> android first. IOS when the android is shipped
- Backend hints: not sure, since this is mobile app now and not website.
- Hard limits: none.

## Part 5 — Success
- What "done" means for v1: all functions/modules working in local emu (not shipped yet)
- Open questions: what you're unsure about and want Rose to research -> whats the best tools to use for an app like this, are we using cloudflare for database? how will this operate?
