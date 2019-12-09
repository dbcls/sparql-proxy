#!/usr/bin/env ruby

require 'linkeddata'
require 'sparql'
require 'sinatra'
require 'sinatra/sparql'

repository = RDF::Repository.new do |graph|
  graph << [RDF::IRI.new("http://example.com"), RDF::Vocab::DC.title, "Hello, world!"]
end

get '/sparql' do
    query = ::URI.decode(params["query"].to_s)
    SPARQL.execute(query, repository)
end

post '/sparql' do
    query = ::URI.decode(params["query"].to_s)
    SPARQL.execute(query, repository)
end
